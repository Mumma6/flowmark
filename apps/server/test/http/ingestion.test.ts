import {
  createFlowmark,
  type WorkflowRunReference,
} from "../../../../packages/sdk/src/index.js"
import { Effect } from "effect"
import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projectApiKeys,
  projects,
  workflowRuns,
  workflowEvents,
  workspaces,
  workflows,
} from "@flowmark/db"
import { and, eq } from "drizzle-orm"
import { hashApiKey } from "@flowmark/db/persistence"
import { DEMO_WRITE_KEY } from "@flowmark/db/demo"
import { POST } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "PostgreSQL ingestion and project isolation",
  () => {
    const projectId = randomUUID()
    const workspaceId = randomUUID()
    const writeKey = randomUUID()
    const readKey = randomUUID()
    const otherProjectId = randomUUID()
    const otherReadKey = randomUUID()
    const runId = randomUUID()
    let connection: ReturnType<typeof createDatabase>
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      await connection.db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Isolated test workspace" })
      await connection.db.insert(projects).values([
        { id: projectId, workspaceId, name: "Isolated test project" },
        { id: otherProjectId, workspaceId, name: "Other test project" },
      ])
      await connection.db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(writeKey), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
        {
          projectId: otherProjectId,
          keyHash: hashApiKey(otherReadKey),
          permission: "read",
        },
      ])
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })
    const send = (
      event: unknown,
      key: string = writeKey,
      eventId: string = randomUUID(),
    ) =>
      POST(
        new Request("http://localhost/v1/events", {
          method: "POST",
          headers: { authorization: `Bearer ${key}` },
          body: JSON.stringify({ eventId, event }),
        }),
      )
    const caller = (key: string) =>
      appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${key}` },
        }),
      })

    it("rejects missing keys, read keys on writes, and malformed events", async () => {
      const event = {
        type: "started",
        workflow: "test",
        runId,
        timestamp: new Date().toISOString(),
      }
      expect((await send(event, "")).status).toBe(401)
      expect((await send(event, readKey)).status).toBe(401)
      expect((await send({ ...event, timestamp: "not-a-date" })).status).toBe(
        400,
      )
      expect((await send({ ...event, workflow: "" })).status).toBe(400)
      expect(
        (
          await send({
            ...event,
            correlationId: "c".repeat(129),
          })
        ).status,
      ).toBe(400)
      expect(
        (
          await send({
            ...event,
            parentRunId: event.runId,
          })
        ).status,
      ).toBe(400)
      expect(
        (await send({ ...event, properties: { oversized: "x".repeat(65536) } }))
          .status,
      ).toBe(400)
      expect(
        (await send({ ...event, type: "step", step: "before-start" })).status,
      ).toBe(409)
    })

    it("persists terminal outcomes without result and accepts calls without outcome", async () => {
      const outcomeProjectId = randomUUID()
      const outcomeWriteKey = randomUUID()
      const outcomeReadKey = randomUUID()
      await connection.db.insert(projects).values({
        id: outcomeProjectId,
        workspaceId,
        name: "Outcome fixtures only",
      })
      await connection.db.insert(projectApiKeys).values([
        {
          projectId: outcomeProjectId,
          keyHash: hashApiKey(outcomeWriteKey),
          permission: "write",
        },
        {
          projectId: outcomeProjectId,
          keyHash: hashApiKey(outcomeReadKey),
          permission: "read",
        },
      ])
      for (const terminal of [
        { type: "completed", outcome: "complete", result: { imported: 3 } },
        { type: "completed", outcome: "no-availability" },
        {
          type: "failed",
          outcome: "partial",
          failure: { code: "CRM_TIMEOUT" },
          result: { updated: 80 },
        },
        { type: "completed", result: { outcome: "custom-result-value" } },
        { type: "completed" },
      ]) {
        const externalId = randomUUID()
        const base = {
          workflow: "outcomes",
          runId: externalId,
          timestamp: new Date().toISOString(),
        }
        expect(
          (await send({ ...base, type: "started" }, outcomeWriteKey)).status,
        ).toBe(202)
        expect(
          (
            await send(
              { ...base, ...terminal, outcome: "INVALID" },
              outcomeWriteKey,
            )
          ).status,
        ).toBe(400)
        const envelopeId = randomUUID()
        expect(
          (await send({ ...base, ...terminal }, outcomeWriteKey, envelopeId))
            .status,
        ).toBe(202)
        expect(
          (await send({ ...base, ...terminal }, outcomeWriteKey, envelopeId))
            .status,
        ).toBe(202)
        const page = await caller(outcomeReadKey).run.list({ externalId })
        expect(page.runs[0]).toMatchObject({
          outcome: "outcome" in terminal ? terminal.outcome : null,
          status: terminal.type === "failed" ? "Failed" : "Completed",
        })
        const timeline = await caller(outcomeReadKey).run.detail({
          id: page.runs[0].id,
        })
        expect(timeline).toHaveLength(2)
        expect(timeline[1].outcome).toBe(
          "outcome" in terminal ? terminal.outcome : null,
        )
        expect(
          await caller(otherReadKey).run.detail({ id: page.runs[0].id }),
        ).toEqual([])
      }
    })

    it("bounds streamed bodies and cancels without reading the remainder", async () => {
      const cancel = vi.fn()
      const body = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            controller.enqueue(new Uint8Array(32769))
          },
          cancel,
        },
        { highWaterMark: 0 },
      )
      const options: RequestInit & { duplex: "half" } = {
        method: "POST",
        body,
        duplex: "half",
      }
      const request = new Request("http://localhost/v1/events", options)
      request.headers.set("authorization", `Bearer ${writeKey}`)
      expect((await POST(request)).status).toBe(400)
      expect(cancel).toHaveBeenCalledOnce()
    })

    it("persists events idempotently and derives metrics and timelines", async () => {
      const timestamp = new Date().toISOString()
      const eventId = randomUUID()
      const started = {
        type: "started",
        workflow: "todo.add",
        runId,
        timestamp,
        properties: { todoId: "test-todo" },
      }
      expect((await send(started, writeKey, eventId)).status).toBe(202)
      expect((await send(started, writeKey, eventId)).status).toBe(202)
      expect(
        (
          await send({
            type: "step",
            workflow: "todo.add",
            runId,
            timestamp,
            step: "saved",
          })
        ).status,
      ).toBe(202)
      expect(
        (
          await send({
            type: "completed",
            workflow: "todo.add",
            runId,
            timestamp,
          })
        ).status,
      ).toBe(202)
      const snapshot = await caller(readKey).project.snapshot()
      expect(snapshot.metrics).toMatchObject({
        totalRuns: 1,
        failedRuns: 0,
        successRate: 100,
        medianDurationMs: expect.any(Number),
        p95DurationMs: expect.any(Number),
      })
      expect(snapshot.runs[0]).toMatchObject({
        workflow: "todo.add",
        status: "Completed",
        step: "saved",
      })
      expect(snapshot.daily).toHaveLength(30)
      expect(snapshot.daily[0]).toMatchObject({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        count: expect.any(Number),
        completed: expect.any(Number),
        failed: expect.any(Number),
      })
      expect(snapshot.operations).toEqual([])
      expect(snapshot.failureCodes).toEqual([])
      const comparison = await caller(readKey).run.compare({
        id: snapshot.runs[0].id,
      })
      expect(comparison.current).toMatchObject({
        workflow: "todo.add",
        status: "Completed",
      })
      expect(comparison.peers).toEqual([])
      const timeline = await caller(readKey).run.detail({
        id: snapshot.runs[0].id,
      })
      expect(timeline).toHaveLength(3)
      expect(timeline[0].properties).toEqual({ todoId: "test-todo" })
    })

    it("persists amendments, recoverable errors, results and receipt timestamps", async () => {
      const structuredRun = randomUUID()
      const timestamp = new Date().toISOString()
      const start = {
        type: "started",
        workflow: "checkout.structured",
        runId: structuredRun,
        timestamp,
        properties: { orderId: "order-123", region: "eu" },
        environment: "production",
        release: "2026.10.23",
      }
      await send(start)
      await send({
        type: "step",
        workflow: "checkout.structured",
        runId: structuredRun,
        timestamp,
        step: "payment-authorized",
        properties: { provider: "stripe" },
      })

      const amendmentId = randomUUID()
      const amendment = {
        type: "properties",
        workflow: "checkout.structured",
        runId: structuredRun,
        timestamp,
        properties: { region: "eu-west", attempt: 2 },
      }
      await send(amendment, writeKey, amendmentId)
      await send(amendment, writeKey, amendmentId)
      await send({
        type: "error",
        workflow: "checkout.structured",
        runId: structuredRun,
        timestamp,
        error: {
          code: "inventory-retry",
          message: "A retry was scheduled",
          retryable: true,
          handled: true,
        },
      })
      await send({
        type: "completed",
        workflow: "checkout.structured",
        runId: structuredRun,
        timestamp,
        result: { receiptId: "receipt-123", total: 42 },
      })

      const snapshot = await caller(readKey).project.snapshot()
      const summary = snapshot.runs.find(
        (run) => run.externalId === structuredRun,
      )!
      expect(summary.status).toBe("Completed")
      const timeline = await caller(readKey).run.detail({ id: summary.id })
      expect(timeline.map((entry) => entry.type)).toEqual([
        "started",
        "step",
        "properties",
        "error",
        "completed",
      ])
      expect(timeline[0]).toMatchObject({
        environment: "production",
        release: "2026.10.23",
        properties: { orderId: "order-123", region: "eu" },
      })
      expect(timeline[1].properties).toEqual({ provider: "stripe" })
      expect(timeline[2].properties).toEqual({
        region: "eu-west",
        attempt: 2,
      })
      expect(timeline[3].error).toMatchObject({
        code: "inventory-retry",
        handled: true,
      })
      expect(timeline[4].result).toEqual({
        receiptId: "receipt-123",
        total: 42,
      })
      expect(
        timeline.every((entry) =>
          Number.isFinite(Date.parse(entry.receivedAt)),
        ),
      ).toBe(true)

      const [storedRun] = await connection.db
        .select({
          properties: workflowRuns.properties,
          error: workflowRuns.error,
          result: workflowRuns.result,
          environment: workflowRuns.environment,
          release: workflowRuns.release,
        })
        .from(workflowRuns)
        .where(eq(workflowRuns.externalId, structuredRun))
      expect(storedRun).toMatchObject({
        properties: {
          orderId: "order-123",
          region: "eu-west",
          attempt: 2,
        },
        error: { code: "inventory-retry", handled: true },
        result: { receiptId: "receipt-123", total: 42 },
        environment: "production",
        release: "2026.10.23",
      })
      expect(storedRun.properties).not.toHaveProperty("provider")
    })

    it("persists explicit links and returns project-scoped correlations beyond the snapshot limit", async () => {
      const timestamp = new Date().toISOString()
      const parentRunId = randomUUID()
      await send({
        type: "started",
        workflow: "stage3.parent",
        runId: parentRunId,
        timestamp,
      })
      await send({
        type: "started",
        workflow: "stage3.parent.duplicate",
        runId: parentRunId,
        timestamp,
      })
      const correlationId = randomUUID()
      const childExternalId = randomUUID()
      await send({
        type: "started",
        workflow: "stage3.child",
        runId: childExternalId,
        timestamp,
        correlationId,
        parentRunId,
      })

      const workflowName = "stage3.related.sibling"
      await connection.db
        .insert(workflows)
        .values({ projectId, name: workflowName })
        .onConflictDoNothing()
      const [definition] = await connection.db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.projectId, projectId),
            eq(workflows.name, workflowName),
          ),
        )
      const siblings = Array.from({ length: 105 }, () => ({
        workflowId: definition!.id,
        externalId: randomUUID(),
        startedAt: new Date(Date.parse(timestamp) - 1000),
        correlationId,
      }))
      await connection.db.insert(workflowRuns).values(siblings)

      const snapshot = await caller(readKey).project.snapshot()
      const child = snapshot.runs.find(
        (run) => run.externalId === childExternalId,
      )!
      const timeline = await caller(readKey).run.detail({ id: child.id })
      expect(timeline[0]).toMatchObject({ correlationId, parentRunId })
      const related = await caller(readKey).run.related({ id: child.id })
      expect(related.parentMatches).toHaveLength(2)
      expect(related.parentMatches.map((run) => run.workflow)).toEqual(
        expect.arrayContaining(["stage3.parent", "stage3.parent.duplicate"]),
      )
      expect(related.related).toHaveLength(105)
      const snapshotIds = new Set(snapshot.runs.map((run) => run.id))
      expect(related.related.some((run) => !snapshotIds.has(run.id))).toBe(true)
      const inaccessible = await caller(otherReadKey).run.related({
        id: child.id,
      })
      expect(inaccessible).toEqual({ parentMatches: [], related: [] })
    })

    it("persists concurrent operation identity, duration and progress snapshots", async () => {
      const operationRun = randomUUID()
      const paymentOperationId = randomUUID()
      const stockOperationId = randomUUID()
      const timestamp = new Date().toISOString()
      const workflow = "checkout.operations"
      await send({ type: "started", workflow, runId: operationRun, timestamp })
      const operationEvents = [
        {
          type: "operation_started",
          workflow,
          runId: operationRun,
          timestamp,
          operationId: paymentOperationId,
          operationName: "charge-payment",
        },
        {
          type: "operation_started",
          workflow,
          runId: operationRun,
          timestamp,
          operationId: stockOperationId,
          operationName: "reserve-stock",
        },
        {
          type: "operation_completed",
          workflow,
          runId: operationRun,
          timestamp,
          operationId: paymentOperationId,
          operationName: "charge-payment",
          durationMs: 12.75,
        },
        {
          type: "operation_failed",
          workflow,
          runId: operationRun,
          timestamp,
          operationId: stockOperationId,
          operationName: "reserve-stock",
          durationMs: 9.5,
          failure: { code: "out-of-stock", retryable: false },
        },
      ] as const
      const duplicateEventId = randomUUID()
      expect(
        (await send(operationEvents[0], writeKey, duplicateEventId)).status,
      ).toBe(202)
      expect(
        (await send(operationEvents[0], writeKey, duplicateEventId)).status,
      ).toBe(202)
      for (const event of operationEvents.slice(1)) {
        expect((await send(event)).status).toBe(202)
      }
      const beforeWorkflowCompletion = await caller(readKey).project.snapshot()
      expect(
        beforeWorkflowCompletion.runs.find(
          (item) => item.externalId === operationRun,
        )?.status,
      ).toBe("Running")
      await send({
        type: "progress",
        workflow,
        runId: operationRun,
        timestamp,
        completed: 1,
        total: 5,
        unit: "items",
      })
      await send({
        type: "progress",
        workflow,
        runId: operationRun,
        timestamp,
        completed: 3,
        total: 5,
        unit: "items",
      })
      await send({
        type: "completed",
        workflow,
        runId: operationRun,
        timestamp,
      })

      const snapshot = await caller(readKey).project.snapshot()
      const run = snapshot.runs.find(
        (item) => item.externalId === operationRun,
      )!
      expect(run.status).toBe("Completed")
      expect(snapshot.operations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "charge-payment",
            workflow: "checkout.operations",
            count: 1,
            failed: 0,
          }),
          expect.objectContaining({
            name: "reserve-stock",
            workflow: "checkout.operations",
            count: 1,
            failed: 1,
          }),
        ]),
      )
      const timeline = await caller(readKey).run.detail({ id: run.id })
      expect(timeline.map((event) => event.type)).toEqual([
        "started",
        "operation_started",
        "operation_started",
        "operation_completed",
        "operation_failed",
        "progress",
        "progress",
        "completed",
      ])
      expect(
        timeline.filter((event) => event.type === "operation_started"),
      ).toMatchObject([
        {
          operationId: paymentOperationId,
          operationName: "charge-payment",
        },
        {
          operationId: stockOperationId,
          operationName: "reserve-stock",
        },
      ])
      expect(timeline[3]).toMatchObject({
        operationId: paymentOperationId,
        durationMs: 12.75,
      })
      expect(timeline[4]).toMatchObject({
        operationId: stockOperationId,
        durationMs: 9.5,
        error: { code: "out-of-stock", retryable: false },
      })
      expect(timeline.slice(5, 7)).toMatchObject([
        { completed: 1, total: 5, unit: "items" },
        { completed: 3, total: 5, unit: "items" },
      ])
    })

    it("continues a booking across fresh SDK clients without changing the first terminal or application errors", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const originalFetch = vi.fn<typeof fetch>((input, init) =>
            POST(new Request(input, init)),
          )
          vi.stubGlobal("fetch", originalFetch)
          const config = { apiKey: writeKey, apiUrl: "http://localhost" }
          const submission = createFlowmark(config)
          const flow = submission.workflow("booking.create", {
            properties: { bookingRef: "synthetic-booking-42" },
            environment: "test",
            release: "submission",
          })
          const reference: WorkflowRunReference = {
            workflow: "booking.create",
            runId: flow.runId,
          }
          flow.step("awaiting-confirmation")
          flow.report({ reserved: 0 })
          yield* Effect.promise(() => submission.shutdown())
          const open = yield* Effect.promise(() =>
            caller(readKey).run.list({
              workflow: reference.workflow,
              externalId: reference.runId,
            }),
          )
          const openRun = open.runs.find(
            (row) => row.externalId === reference.runId,
          )!
          expect(openRun).toMatchObject({
            status: "Running",
            result: null,
            outcome: null,
          })
          const callback = createFlowmark(config)
          const continuation = callback.workflow(reference.workflow, {
            id: reference.runId,
            release: "must-not-replace",
            properties: { mustNotReplace: true },
          })
          continuation.setProperties({ callbackSeen: true })
          continuation.done({ outcome: "confirmed", result: { reserved: 1 } })
          yield* Effect.promise(() => callback.shutdown())
          const diagnostic = vi.fn()
          const duplicateCallback = createFlowmark({
            ...config,
            onInstrumentationError: diagnostic,
          })
          const duplicate = duplicateCallback.workflow(reference.workflow, {
            id: reference.runId,
          })
          duplicate.fail({
            code: "LATE_CALLBACK",
            outcome: "rejected",
            result: { reserved: 0 },
          })
          yield* Effect.promise(() =>
            expect(duplicateCallback.flush()).rejects.toMatchObject({
              _tag: "FlowmarkDeliveryError",
            }),
          )
          expect(diagnostic).toHaveBeenCalledOnce()
          expect(diagnostic.mock.calls[0]?.[1]).toMatchObject({
            type: "failed",
          })
          const applicationCause = new Error("original application error")
          yield* Effect.promise(() =>
            expect(
              duplicate.operation("late-callback", () =>
                Promise.reject(applicationCause),
              ),
            ).rejects.toBe(applicationCause),
          )
          yield* Effect.promise(() => duplicateCallback.shutdown())
          const final = yield* Effect.promise(() =>
            caller(readKey).run.detail({ id: openRun.id }),
          )
          expect(
            final.filter((event) =>
              ["completed", "failed"].includes(event.type),
            ),
          ).toHaveLength(1)
          expect(
            final.find((event) => event.type === "completed"),
          ).toMatchObject({ outcome: "confirmed", result: { reserved: 1 } })
          expect(final[0]).toMatchObject({
            release: "submission",
            properties: { bookingRef: "synthetic-booking-42" },
          })
          const retry = createFlowmark(config)
          const anotherAttempt = retry.workflow(reference.workflow)
          expect(anotherAttempt.runId).not.toBe(reference.runId)
          anotherAttempt.done({
            outcome: "unavailable",
            result: { reserved: 0 },
          })
          yield* Effect.promise(() => retry.shutdown())
          vi.unstubAllGlobals()
        }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllGlobals()))),
      ))

    it("preserves historical mixed-terminal evidence without accepting another terminal", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const id = randomUUID(),
            workflow = "historical.mixed"
          const base = {
            workflow,
            runId: id,
            timestamp: "2026-01-01T00:00:00Z",
          }
          yield* Effect.promise(() => send({ ...base, type: "started" }))
          yield* Effect.promise(() =>
            send({
              ...base,
              type: "completed",
              outcome: "complete",
              result: { items: 5 },
            }),
          )
          const snapshot = yield* Effect.promise(() =>
            caller(readKey).run.list({ workflow, externalId: id }),
          )
          const run = snapshot.runs.find((row) => row.externalId === id)!
          // Synthetic representation of events persisted before TASK-003. No history rewrite.
          yield* Effect.promise(() =>
            connection.db.insert(workflowEvents).values({
              eventId: randomUUID(),
              runId: run.id,
              type: "failed",
              occurredAt: new Date("2026-01-02T00:00:00Z"),
              result: { items: 3 },
              outcome: "partial",
              error: { code: "OLD_FAILURE" },
            }),
          )
          yield* Effect.promise(() =>
            connection.db
              .update(workflowRuns)
              .set({ result: { items: 3 }, outcome: "partial" })
              .where(eq(workflowRuns.id, run.id)),
          )
          expect(
            (yield* Effect.promise(() => send({ ...base, type: "completed" })))
              .status,
          ).toBe(409)
          const after = yield* Effect.promise(() =>
            caller(readKey).run.list({ workflow, externalId: id }),
          )
          expect(after.runs.find((row) => row.id === run.id)).toMatchObject({
            status: "Failed",
            result: { items: 3 },
            outcome: "partial",
          })
          expect(
            (yield* Effect.promise(() =>
              caller(readKey).run.detail({ id: run.id }),
            )).map((event) => event.type),
          ).toEqual(["started", "completed", "failed"])
        }),
      ))

    it("serializes terminals across requests and acknowledges duplicates, ignores and conflicts explicitly", () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const id = randomUUID()
          const startId = randomUUID()
          const workflow = "booking.concurrent"
          const base = {
            workflow,
            runId: id,
            timestamp: "2026-01-02T00:00:00Z",
          }
          const receipt = Effect.fn("test.receipt")(function* (
            event: unknown,
            eventId = randomUUID(),
          ) {
            const response = yield* Effect.promise(() =>
              send(event, writeKey, eventId),
            )
            return {
              status: response.status,
              body: yield* Effect.promise(() => response.json()),
            }
          })
          const started = {
            ...base,
            type: "started",
            properties: {
              bookingRef: "synthetic-booking",
              nested: { original: true },
            },
            environment: "test",
            release: "first",
            correlationId: "correlation-first",
          }
          expect(yield* receipt(started, startId)).toMatchObject({
            status: 202,
            body: { accepted: true, disposition: "recorded" },
          })
          expect(yield* receipt(started, startId)).toMatchObject({
            status: 202,
            body: { disposition: "duplicate" },
          })
          expect(
            yield* receipt({
              ...started,
              properties: { replaced: true },
              release: "second",
              environment: "other",
              correlationId: "other",
            }),
          ).toMatchObject({
            status: 202,
            body: { accepted: false, disposition: "ignored" },
          })
          yield* receipt({
            ...base,
            type: "properties",
            properties: { callbackSeen: true, nested: { amended: true } },
          })
          yield* receipt({ ...base, type: "report", result: { reserved: 1 } })
          const doneId = randomUUID(),
            failId = randomUUID()
          const completed = {
            ...base,
            type: "completed",
            outcome: "confirmed",
            result: { reserved: 1 },
          }
          const failed = {
            ...base,
            timestamp: "2025-01-01T00:00:00Z",
            type: "failed",
            failure: { code: "DECLINED" },
            outcome: "rejected",
            result: { reserved: 0 },
          }
          const decisions = yield* Effect.all(
            [receipt(completed, doneId), receipt(failed, failId)],
            { concurrency: 2 },
          )
          expect(decisions.map((decision) => decision.status).sort()).toEqual([
            202, 409,
          ])
          const winner = decisions[0].status === 202 ? completed : failed
          const winningId = decisions[0].status === 202 ? doneId : failId
          expect(yield* receipt(winner, winningId)).toMatchObject({
            status: 202,
            body: { disposition: "duplicate" },
          })
          expect(yield* receipt(winner)).toMatchObject({
            status: 409,
            body: { code: "EVENT_CONFLICT", accepted: false },
          })
          for (const event of [
            { ...base, type: "step", step: "late" },
            {
              ...base,
              type: "properties",
              properties: { callbackSeen: false },
            },
            { ...base, type: "progress", completed: 2 },
            { ...base, type: "report", result: { reserved: 999 } },
            {
              ...base,
              type: "operation_started",
              operationId: randomUUID(),
              operationName: "late",
            },
          ]) {
            expect(yield* receipt(event)).toMatchObject({
              status: 202,
              body: { accepted: false, disposition: "ignored" },
            })
          }
          const snapshot = yield* Effect.promise(() =>
            caller(readKey).run.list({ workflow, externalId: id }),
          )
          const run = snapshot.runs.find((row) => row.externalId === id)!
          expect(run).toMatchObject({
            status: winner.type === "completed" ? "Completed" : "Failed",
            outcome: winner.outcome,
            result: winner.result,
          })
          const timeline = yield* Effect.promise(() =>
            caller(readKey).run.detail({ id: run.id }),
          )
          expect(timeline).toHaveLength(4)
          expect(
            timeline.filter((event) =>
              ["completed", "failed"].includes(event.type),
            ),
          ).toHaveLength(1)
          expect(
            timeline.find((event) => event.type === "started"),
          ).toMatchObject({
            properties: started.properties,
            environment: "test",
            release: "first",
            correlationId: "correlation-first",
          })
          const [stored] = yield* Effect.promise(() =>
            connection.db
              .select()
              .from(workflowRuns)
              .where(eq(workflowRuns.id, run.id)),
          )
          expect(stored.properties).toEqual({
            bookingRef: "synthetic-booking",
            callbackSeen: true,
            nested: { amended: true },
          })
          expect(stored.result).toEqual(winner.result)
          expect(
            yield* receipt({ ...completed, runId: randomUUID() }),
          ).toMatchObject({ status: 409, body: { code: "RUN_NOT_FOUND" } })
          const failedFirstId = randomUUID()
          yield* receipt({ ...started, runId: failedFirstId })
          expect(
            yield* receipt({ ...failed, runId: failedFirstId }),
          ).toMatchObject({ status: 202, body: { disposition: "recorded" } })
          expect(
            yield* receipt({ ...completed, runId: failedFirstId }),
          ).toMatchObject({ status: 409, body: { disposition: "conflict" } })
          const refusedStartId = randomUUID()
          expect(
            yield* receipt({ ...started, runId: refusedStartId }, winningId),
          ).toMatchObject({ status: 409 })
          expect(
            (yield* Effect.promise(() =>
              caller(readKey).run.list({
                workflow,
                externalId: refusedStartId,
              }),
            )).total,
          ).toBe(0)
          const otherWriteKey = randomUUID()
          yield* Effect.promise(() =>
            connection.db.insert(projectApiKeys).values({
              projectId: otherProjectId,
              keyHash: hashApiKey(otherWriteKey),
              permission: "write",
            }),
          )
          const crossProject = yield* Effect.promise(() =>
            send({ ...started, runId: randomUUID() }, otherWriteKey, winningId),
          )
          expect(crossProject.status).toBe(409)
          expect(yield* Effect.promise(() => crossProject.json())).toEqual({
            accepted: false,
            disposition: "conflict",
            code: "EVENT_CONFLICT",
            error: "Event conflicts with previously accepted telemetry.",
          })
          expect(
            (yield* Effect.promise(() =>
              caller(otherReadKey).run.list({ workflow }),
            )).total,
          ).toBe(0)
          const otherId = randomUUID()
          yield* receipt({ ...started, runId: otherId })
          expect(
            yield* receipt(
              { ...base, runId: otherId, type: "step", step: "collision" },
              winningId,
            ),
          ).toMatchObject({ status: 409, body: { code: "EVENT_CONFLICT" } })
        }),
      ))

    it("continues the same run when later requests reuse the execution id", async () => {
      const continuedRun = randomUUID()
      const workflow = "expedition.run"
      const timestamp = new Date().toISOString()
      await send({
        type: "started",
        workflow,
        runId: continuedRun,
        timestamp,
        properties: { battleCount: 3 },
      })
      await send({
        type: "started",
        workflow,
        runId: continuedRun,
        timestamp,
        properties: { shouldNotReplace: true },
      })
      await send({
        type: "step",
        workflow,
        runId: continuedRun,
        timestamp,
        step: "battle-claimed",
      })
      await send({
        type: "completed",
        workflow,
        runId: continuedRun,
        timestamp,
        result: { battlesWon: 2 },
      })
      await send({
        type: "step",
        workflow,
        runId: continuedRun,
        timestamp,
        step: "ignored-after-done",
      })
      const conflict = await send({
        type: "failed",
        workflow,
        runId: continuedRun,
        timestamp,
        failure: { code: "EXPEDITION_ABANDONED" },
        result: { battlesWon: 2, abandoned: true },
      })

      expect(conflict.status).toBe(409)
      expect(await conflict.json()).toMatchObject({
        accepted: false,
        disposition: "conflict",
        code: "EVENT_CONFLICT",
      })
      const snapshot = await caller(readKey).project.snapshot()
      const summary = snapshot.runs.find(
        (run) => run.externalId === continuedRun,
      )!
      expect(summary.status).toBe("Completed")
      expect(summary.result).toEqual({
        battlesWon: 2,
      })
      const timeline = await caller(readKey).run.detail({ id: summary.id })
      expect(timeline.map((entry) => entry.type)).toEqual([
        "started",
        "step",
        "completed",
      ])
      expect(timeline[0]).toMatchObject({
        properties: { battleCount: 3 },
      })
      expect(timeline[0].properties).not.toHaveProperty("shouldNotReplace")
      expect(timeline.map((entry) => entry.step)).toEqual([
        null,
        "battle-claimed",
        null,
      ])
    })

    it("does not expose project data through another project's read key", async () => {
      const snapshot = await caller(readKey).project.snapshot()
      const otherProject = await caller(otherReadKey).run.detail({
        id: snapshot.runs[0].id,
      })
      expect(otherProject).toEqual([])
      await expect(caller(writeKey).project.snapshot()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
      await expect(caller("invalid").project.snapshot()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })

    it("records failed runs and rejects public demo credentials when demo mode is disabled", async () => {
      const failedRun = randomUUID()
      const timestamp = new Date().toISOString()
      await send({
        type: "started",
        workflow: "todo.fail",
        runId: failedRun,
        timestamp,
      })
      await send({
        type: "failed",
        workflow: "todo.fail",
        runId: failedRun,
        timestamp,
        reason: "test-failure",
      })
      const structuredFailureRun = randomUUID()
      await send({
        type: "started",
        workflow: "todo.fail.structured",
        runId: structuredFailureRun,
        timestamp,
      })
      await send({
        type: "failed",
        workflow: "todo.fail.structured",
        runId: structuredFailureRun,
        timestamp,
        failure: {
          code: "payment-declined",
          message: "Payment was declined",
          retryable: false,
        },
        result: { captured: false, reserved: true },
      })
      const snapshot = await caller(readKey).project.snapshot()
      const failedPopulation = await caller(readKey).run.list({
        status: "Failed",
      })
      expect(snapshot.metrics.failedRuns).toBe(failedPopulation.total)
      expect(snapshot.failureCodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "test-failure",
            workflow: "todo.fail",
            count: 1,
          }),
          expect.objectContaining({
            code: "payment-declined",
            workflow: "todo.fail.structured",
            count: 1,
          }),
        ]),
      )
      const failedSummary = snapshot.runs.find(
        (run) => run.externalId === failedRun,
      )!
      expect(failedSummary.status).toBe("Failed")
      const timeline = await caller(readKey).run.detail({
        id: failedSummary.id,
      })
      expect(timeline[1].error).toEqual({ code: "test-failure" })
      const structuredFailureSummary = snapshot.runs.find(
        (run) => run.externalId === structuredFailureRun,
      )!
      expect(structuredFailureSummary.status).toBe("Failed")
      expect(structuredFailureSummary.result).toEqual({
        captured: false,
        reserved: true,
      })
      const structuredTimeline = await caller(readKey).run.detail({
        id: structuredFailureSummary.id,
      })
      expect(structuredTimeline[1].error).toEqual({
        code: "payment-declined",
        message: "Payment was declined",
        retryable: false,
      })
      expect(structuredTimeline[1].result).toEqual({
        captured: false,
        reserved: true,
      })
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      expect(
        (
          await send(
            {
              type: "started",
              workflow: "demo",
              runId: randomUUID(),
              timestamp,
            },
            DEMO_WRITE_KEY,
          )
        ).status,
      ).toBe(401)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    })
  },
)
