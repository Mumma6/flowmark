import { randomUUID } from "node:crypto"
import { Array as EffectArray, Effect } from "effect"
import { eq } from "drizzle-orm"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import {
  createDatabase,
  workflowEvents,
  workflowRuns,
  workflowExpectations,
  workflows,
} from "@flowmark/db"
import {
  Database,
  ExpectationObservationClock,
  rebuildExpectations,
  WorkflowStore,
  type WorkflowStoreService,
} from "@flowmark/db/persistence"
import { POST as register } from "../../app/api/register/route"
import { POST as auth } from "../../app/api/auth/[...all]/route"
import {
  revokeAutomaticSignupSessions,
  revokeSessionsForEmails,
} from "./signup-sessions"
import { POST } from "../../app/v1/events/route"
import { POST as browserPOST } from "../../app/v1/browser-events/route"
import { appRouter } from "../../src/adapters/trpc/router"
import { createFlowmark } from "../../../../packages/sdk/src/index.js"

const clock = vi.hoisted(() => ({ value: "2026-10-31T12:00:00.000Z" }))
// Only this isolated test runtime receives a fake clock. Production has no env/test clock switch.
vi.mock("@flowmark/api", async (original) => {
  const actual = await original<typeof import("@flowmark/api")>()
  const { ExpectationObservationClock } =
    await import("@flowmark/db/persistence")
  const { Effect } = await import("effect")
  const runApi: typeof actual.runApi = (operation, signal) =>
    Effect.runPromiseExit(
      operation.pipe(
        Effect.provide(actual.ApiLive),
        Effect.provideService(ExpectationObservationClock, {
          now: () => Effect.sync(() => new Date(clock.value)),
        }),
      ),
      { signal },
    )
  return { ...actual, runApi }
})
const origin = "http://localhost:3001"
const request = (path: string, body: unknown) =>
  new Request(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  })
const caller = (cookie: string, projectId?: string) =>
  appRouter.createCaller({
    request: new Request(`${origin}/api/trpc`, {
      headers: {
        cookie,
        ...(projectId ? { "x-flowmark-project-id": projectId } : {}),
      },
    }),
  })
const registeredEmails: string[] = []

async function owner(name: string) {
  const email = `expectations-${randomUUID()}@example.test`,
    password = randomUUID()
  expect(
    (await register(request("/api/register", { name, email, password })))
      .status,
  ).toBe(200)
  registeredEmails.push(email)
  await revokeAutomaticSignupSessions(email)
  const signed = await auth(
    request("/api/auth/sign-in/email", { email, password }),
  )
  expect(signed.status).toBe(200)
  const cookie = signed.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")
  return {
    email,
    password,
    cookie,
    ...(await caller(cookie).project.create({ name })),
  }
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "durable expectations through SDK/authorized HTTP/storage/read models",
  () => {
    let connection: ReturnType<typeof createDatabase>
    let store: WorkflowStoreService
    const persistHealthEvents = async (
      projectId: string,
      events: readonly Parameters<WorkflowStoreService["append"]>[2][],
    ) => {
      const dispositions = await Effect.runPromise(
        Effect.forEach(events, (event) =>
          store.append(projectId, randomUUID(), event),
        ).pipe(
          Effect.provideService(ExpectationObservationClock, {
            now: () => Effect.sync(() => new Date(clock.value)),
          }),
        ),
      )
      expect(dispositions).toEqual(EffectArray.map(events, () => "recorded"))
    }
    let primary: Awaited<ReturnType<typeof owner>>,
      foreign: Awaited<ReturnType<typeof owner>>
    const api = () => caller(primary.cookie, primary.project.id)
    const send = (
      event: unknown,
      eventId = randomUUID(),
      key = primary.writeKey.secret,
    ) =>
      POST(
        new Request("http://localhost/v1/events", {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "x-flowmark-expectations": "v1",
          },
          body: JSON.stringify({ eventId, event }),
        }),
      )
    const base = (runId: string, workflow = "booking.expectations") => ({
      workflow,
      runId,
      timestamp: clock.value,
    })
    const declare = (
      runId: string,
      id = "confirmation",
      withinMs = 300000,
    ) => ({
      ...base(runId),
      type: "expectation_declared" as const,
      expectationId: id,
      name: "provider-response",
      withinMs,
    })
    const resolve = (runId: string, id = "confirmation") => ({
      ...base(runId),
      type: "expectation_resolved" as const,
      expectationId: id,
      outcome: "no-availability",
      result: { reserved: 0 },
    })
    const cancel = (runId: string, id = "confirmation") => ({
      ...base(runId),
      type: "expectation_cancelled" as const,
      expectationId: id,
      code: "BOOKING_CANCELLED",
    })
    const find = async (runId: string, workflow = "booking.expectations") =>
      (await api().run.list({ workflow, externalId: runId })).runs[0]!
    const start = async (runId: string) => {
      expect((await send({ ...base(runId), type: "started" })).status).toBe(202)
    }
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      vi.stubEnv("BETTER_AUTH_URL", origin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", origin)
      vi.stubEnv("VERCEL_ENV", "")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      store = await Effect.runPromise(
        WorkflowStore.make.pipe(Effect.provideService(Database, connection.db)),
      )
      primary = await owner("TASK014 expectation verification")
      foreign = await owner("TASK014 isolated project")
    }, 15000)
    beforeEach(() => {
      clock.value = "2026-10-31T12:00:00.000Z"
    })
    afterAll(async () => {
      await revokeSessionsForEmails(registeredEmails)
      await connection?.close()
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    })

    it("assesses a workflow and pages declaration identities across live observations", async () => {
      const workflow = "booking.process-health"
      const current = "2026-10-31T12:00:00.000Z"
      const baseline = "2026-10-30T12:00:00.000Z"
      const record = async (
        runId: string,
        revision: string,
        deadlines: number[],
        projectId = primary.project.id,
      ) => {
        const event = base(runId, workflow)
        await persistHealthEvents(projectId, [
          {
            ...event,
            type: "started",
            properties: { definitionRevision: revision },
          },
          ...EffectArray.map(deadlines, (withinMs, index) => ({
            ...declare(runId, `confirmation-${index}`, withinMs),
            workflow,
          })),
          {
            ...event,
            type: "completed",
            outcome: "submitted",
            result: { private: 7 },
          },
        ])
      }
      clock.value = baseline
      await record("same-revision", "v1", [5])
      clock.value = "2026-10-30T13:00:00.000Z"
      await record("other-revision", "v2", [5])
      clock.value = current
      await record("two-confirmations", "v1", [100, 100, 1_000])
      await record("missing-confirmation", "v1", [])
      await record("foreign", "v1", [100, 100, 100], foreign.project.id)
      clock.value = "2026-10-31T12:00:00.100Z"
      const query = {
        workflow,
        expectationName: "provider-response",
        window: {
          startedAfter: current,
          startedBefore: "2026-11-01T00:00:00.000Z",
        },
        limit: 1,
      }
      const atDeadline = await api().workflow.processHealth(query)
      expect(atDeadline).toMatchObject({
        status: "assessed",
        observedAt: clock.value,
        attention: "zero-denominator",
        current: { expectations: { mature: 0, overdue: 0, pending: 3 } },
        evidence: { total: 0, records: [] },
      })
      clock.value = "2026-10-31T12:00:00.101Z"
      const first = await api().workflow.processHealth(query)
      expect(first.status).toBe("assessed")
      if (first.status !== "assessed" || !first.evidence.nextCursor) {
        throw new Error("Expected continuation")
      }
      expect(first).toMatchObject({
        attention: "overdue",
        current: {
          execution: { completed: 2, failed: 0, withoutTerminal: 0 },
          businessOutcomes: {
            reported: [{ outcome: "submitted", runs: 2 }],
            missing: 0,
          },
          evidenceQuality: {
            revisions: ["v1"],
            runsWithoutDeclaration: 1,
            intendedCoverage: "unknown",
          },
          expectations: { mature: 2, overdue: 2, pending: 1 },
        },
        evidence: { total: 2 },
      })
      const next = await api().workflow.processHealth({
        ...query,
        cursor: first.evidence.nextCursor,
      })
      expect(next.status).toBe("assessed")
      if (next.status !== "assessed") {
        throw new Error("Expected second page")
      }
      expect(next.freshness).toBe("unchanged")
      expect(next.evidence).toMatchObject({ total: 2, nextCursor: null })
      const declarations = [...first.evidence.records, ...next.evidence.records]
      expect(
        declarations.map(({ expectationId }) => expectationId).sort(),
      ).toEqual(["confirmation-0", "confirmation-1"])
      const persisted = await api().run.expectationsPage({
        runId: declarations[0]!.runId,
      })
      expect(
        declarations.every((row) => row.runId === declarations[0]!.runId),
      ).toBe(true)
      expect(
        persisted.expectations.map((row) => row.reference.expectationId),
      ).toEqual(
        expect.arrayContaining(declarations.map((row) => row.expectationId)),
      )

      const selected = declarations[1]!
      const exactQuery = {
        runId: selected.runId,
        expectationId: selected.expectationId,
      }
      const exact = await api().run.expectationsPage(exactQuery)
      expect(exact.totalRecords).toBe(1)
      expect(exact.nextCursor).toBeNull()
      expect(
        exact.expectations.map(({ reference }) => reference.expectationId),
      ).toEqual([selected.expectationId])
      const missing = await api().run.expectationsPage({
        ...exactQuery,
        expectationId: "unknown",
      })
      expect(missing).toMatchObject({
        expectations: [],
        totalRecords: 0,
        nextCursor: null,
      })
      await expect(
        caller(foreign.cookie, foreign.project.id).run.expectationsPage(
          exactQuery,
        ),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })

      await expect(
        caller(foreign.cookie, foreign.project.id).workflow.processHealth({
          ...query,
          cursor: first.evidence.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        api().workflow.processHealth({ ...query, release: "r1" }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("Unsupported"),
      })
      expect(
        await api().workflow.processHealth({
          ...query,
          workflow: "unobserved",
        }),
      ).toEqual({ status: "unsupported-scope" })
      expect(
        await api().workflow.processHealth({
          ...query,
          baseline: { startedAfter: baseline, startedBefore: current },
        }),
      ).toMatchObject({ comparison: { status: "incompatible-revisions" } })
      expect(
        await api().workflow.processHealth({
          ...query,
          baseline: {
            startedAfter: baseline,
            startedBefore: "2026-10-30T13:00:00.000Z",
          },
        }),
      ).toMatchObject({ comparison: { status: "thin-history" } })
      // An adjacent empty half-open baseline excludes the current start.
      expect(
        await api().workflow.processHealth({
          ...query,
          baseline: {
            startedAfter: "2026-10-31T00:00:00.000Z",
            startedBefore: current,
          },
        }),
      ).toMatchObject({ comparison: { status: "zero-denominator" } })

      clock.value = "2026-10-31T12:00:00.200Z"
      expect(
        (
          await send({
            ...resolve("two-confirmations", "confirmation-0"),
            workflow,
          })
        ).status,
      ).toBe(202)
      const refreshed = await api().workflow.processHealth({
        ...query,
        cursor: first.evidence.nextCursor,
      })
      expect(refreshed).toMatchObject({
        freshness: "refreshed",
        observedAt: clock.value,
        current: { expectations: { mature: 2, overdue: 1, metLate: 1 } },
        evidence: {
          total: 1,
          records: [{ expectationId: "confirmation-1" }],
          nextCursor: null,
        },
      })
      expect(
        await api().workflow.processHealth({
          ...query,
          previousObservation: first.observation,
        }),
      ).toEqual(refreshed)
    }, 30_000)

    it("keeps a quiet mature cohort distinct from omissions and exclusions", async () => {
      const workflow = "booking.process-health-quiet"
      await persistHealthEvents(primary.project.id, [
        { ...base("reported", workflow), type: "started" },
        { ...base("omitted", workflow), type: "started" },
        ...EffectArray.map(
          ["met", "cancelled", "unavailable", "other"],
          (expectationId) => ({
            ...declare("reported", expectationId, 100),
            workflow,
            name:
              expectationId === "other"
                ? "different-signal"
                : "provider-response",
          }),
        ),
        { ...resolve("reported", "met"), workflow },
        { ...cancel("reported", "cancelled"), workflow },
        { ...resolve("reported", "unmatched"), workflow },
      ])
      const run = await find("reported", workflow)
      const projections = await connection.db
        .select()
        .from(workflowExpectations)
        .where(eq(workflowExpectations.runId, run.id))
      const unavailable = projections.find(
        (row) => row.expectationId === "unavailable",
      )
      await connection.db
        .update(workflowEvents)
        .set({ expectationEffective: false })
        .where(eq(workflowEvents.id, unavailable!.declarationEventId!))
      clock.value = "2026-10-31T12:00:00.200Z"
      const health = await api().workflow.processHealth({
        workflow,
        expectationName: "provider-response",
        window: {
          startedAfter: "2026-10-31T12:00:00.000Z",
          startedBefore: "2026-11-01T00:00:00.000Z",
        },
        evidence: "mature",
      })
      expect(health).toMatchObject({
        attention: "quiet",
        current: {
          execution: { withoutTerminal: 2 },
          evidenceQuality: {
            runsWithoutDeclaration: 1,
            unavailableProjections: 1,
            otherExpectationDeclarations: 1,
            settlementsWithoutDeclaration: 1,
            intendedCoverage: "unknown",
          },
          expectations: {
            mature: 1,
            overdue: 0,
            metOnTime: 1,
            metLate: 0,
            cancelled: 1,
          },
        },
        evidence: {
          total: 1,
          records: [
            { runId: run.id, expectationId: "met", state: "met-on-time" },
          ],
        },
      })
    })

    it("rejects legacy proxy forwarding even with a valid server key and leaves ordinary telemetry unchanged", async () => {
      await start("protocol-boundary")
      const response = await POST(
        new Request("http://localhost/v1/events", {
          method: "POST",
          headers: { authorization: `Bearer ${primary.writeKey.secret}` },
          body: JSON.stringify({
            eventId: randomUUID(),
            event: declare("protocol-boundary"),
          }),
        }),
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({
        code: "EXPECTATION_SOURCE_FORBIDDEN",
      })
      const run = await find("protocol-boundary")
      expect(
        (await api().run.expectations({ id: run.id })).expectations,
      ).toHaveLength(0)
      expect((await send(declare("protocol-boundary"))).status).toBe(202)
      expect(
        (await send({ ...declare("protocol-boundary"), withinMs: 0 })).status,
      ).toBe(400)
    })

    it("keeps an on-time negative business response separate from terminal outcome and drains without a new run", async () => {
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
        POST(new Request(input, init)),
      )
      const client = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: primary.writeKey.secret,
      })
      const flow = client.workflow("booking.expectations", {
        id: "sdk-booking",
      })
      const reference = flow.expect("provider-response", {
        id: "confirmation",
        within: "5m",
      })
      flow.done({ outcome: "submitted", result: { submitted: 1 } })
      await client.flush()
      const run = await find(flow.runId),
        before = await api().run.detail({ id: run.id })
      clock.value = "2026-10-31T12:04:00.000Z"
      client.resolveExpectation(reference, {
        outcome: "no-availability",
        result: { reserved: 0 },
      })
      await client.shutdown()
      vi.unstubAllGlobals()
      const view = await api().run.expectations({ id: run.id })
      expect(view.expectations[0]).toMatchObject({
        state: "met-on-time",
        declaredAt: "2026-10-31T12:00:00.000Z",
        deadlineAt: "2026-10-31T12:05:00.000Z",
        settlement: {
          event: { outcome: "no-availability", result: { reserved: 0 } },
        },
      })
      const after = await api().run.detail({ id: run.id })
      expect(after.filter((e) => e.type === "started")).toHaveLength(1)
      expect(after.find((e) => e.type === "completed")).toEqual(
        before.find((e) => e.type === "completed"),
      )
      expect(await find(flow.runId)).toMatchObject({
        status: "Completed",
        outcome: "submitted",
        result: { submitted: 1 },
        durationMs: run.durationMs,
      })
      expect(
        (await send(declare(flow.runId, "new-after-terminal"))).status,
      ).toBe(409)
      expect(
        (
          await send({
            ...base(flow.runId),
            type: "report",
            result: { submitted: 99 },
          })
        ).status,
      ).toBe(202)
      expect(
        (await api().run.detail({ id: run.id })).some(
          (e) => e.type === "report",
        ),
      ).toBe(false)
    })

    it("uses exact read/resolve deadline boundaries, preserves delayed timestamps and survives a fresh SDK request", async () => {
      await start("deadline")
      await send(declare("deadline"))
      const run = await find("deadline")
      clock.value = "2026-10-31T12:05:00.000Z"
      expect(
        (await api().run.expectations({ id: run.id })).expectations[0]?.state,
      ).toBe("pending")
      clock.value = "2026-10-31T12:05:00.001Z"
      expect(
        (await api().run.expectations({ id: run.id })).expectations[0]?.state,
      ).toBe("overdue")
      clock.value = "2026-10-31T12:06:00.000Z"
      const reported = {
        ...resolve("deadline"),
        timestamp: "2026-10-31T12:04:00.000Z",
      }
      await send(reported)
      const late = (await api().run.expectations({ id: run.id }))
        .expectations[0]!
      expect(late).toMatchObject({
        state: "met-late",
        settledAt: clock.value,
        deadlineAt: "2026-10-31T12:05:00.000Z",
        settlement: { event: { timestamp: reported.timestamp } },
      })
      await start("equal")
      await send(declare("equal"))
      const equal = await find("equal")
      clock.value = "2026-10-31T12:11:00.000Z"
      await send(resolve("equal"))
      expect(
        (await api().run.expectations({ id: equal.id })).expectations[0]?.state,
      ).toBe("met-on-time")
    })

    it("retains bounded unmatched evidence, canonical duplicate receipts and deterministic same-time arrival ordering", async () => {
      await start("arrival")
      const action = resolve("arrival"),
        eventId = randomUUID()
      await send(action, eventId)
      await send({ ...action, result: { reserved: 999 } }, eventId)
      expect(
        (await send({ ...base("arrival"), type: "completed" }, eventId)).status,
      ).toBe(409)
      const run = await find("arrival")
      expect(
        (await api().run.expectations({ id: run.id })).unmatched,
      ).toMatchObject([{ state: "unmatched", deadlineAt: null }])
      await send(declare("arrival")) // same wall time: receipt order, not timestamp, identifies the anomaly
      let view = await api().run.expectations({ id: run.id })
      expect(view.expectations[0]).toMatchObject({
        state: "met-on-time",
        outOfOrder: true,
        settlement: { event: { result: { reserved: 0 } } },
      })
      clock.value = "2026-10-31T12:04:00.000Z"
      expect(await (await send(declare("arrival"))).json()).toMatchObject({
        disposition: "duplicate",
      })
      expect(await (await send(action)).json()).toMatchObject({
        disposition: "duplicate",
      })
      expect(
        (await send({ ...declare("arrival"), withinMs: 360000 })).status,
      ).toBe(409)
      expect(
        (await send({ ...declare("arrival"), name: "other" })).status,
      ).toBe(409)
      expect(
        (await send({ ...resolve("arrival"), result: { reserved: 1 } })).status,
      ).toBe(409)
      expect((await send(cancel("arrival"))).status).toBe(409)
      expect(
        (
          await send(
            { ...resolve("arrival"), expectationId: "other-id" },
            eventId,
          )
        ).status,
      ).toBe(409)
      const facts = await connection.db
        .select()
        .from(workflowEvents)
        .where(eq(workflowEvents.runId, run.id))
      expect(facts.filter((e) => e.expectationEffective)).toHaveLength(2)
      expect(
        facts.filter((e) => e.expectation && !e.expectationEffective),
      ).toHaveLength(2)
      // Rebuild from original immutable receipts, even after duplicates and application-process restart.
      await connection.db
        .update(workflowExpectations)
        .set({ declaredAt: null, deadlineAt: null, settledAt: null })
        .where(eq(workflowExpectations.runId, run.id))
      expect(
        (await api().run.expectations({ id: run.id })).unavailableCount,
      ).toBe(1)
      await Effect.runPromise(
        rebuildExpectations(primary.project.id, run.id).pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      view = await api().run.expectations({ id: run.id })
      expect(view.expectations[0]?.deadlineAt).toBe("2026-10-31T12:05:00.000Z")
      expect(view.expectations[0]?.settledAt).toBe("2026-10-31T12:00:00.000Z")
    })

    it("retains cancellation timing, first settlement wins concurrently, and missing runs create no facts", async () => {
      expect((await send(resolve("missing"))).status).toBe(409)
      expect(
        (
          await api().run.list({
            workflow: "booking.expectations",
            externalId: "missing",
          })
        ).runs,
      ).toHaveLength(0)
      await start("cancelled")
      await send(declare("cancelled"))
      clock.value = "2026-10-31T12:06:00.000Z"
      await send({
        ...base("cancelled"),
        type: "failed",
        failure: { code: "SUBMISSION_FAILED" },
        outcome: "partial",
        result: { submitted: 1 },
      })
      expect((await send(cancel("cancelled"))).status).toBe(202)
      const run = await find("cancelled")
      expect(
        (await api().run.expectations({ id: run.id })).expectations[0],
      ).toMatchObject({ state: "cancelled", cancelledAfterDeadline: true })
      expect(await find("cancelled")).toMatchObject({
        status: "Failed",
        outcome: "partial",
        result: { submitted: 1 },
      })
      await start("race")
      await send(declare("race"))
      const statuses = await Promise.all([
        send(resolve("race")),
        send(cancel("race")),
      ])
      expect(statuses.map((r) => r.status).sort()).toEqual([202, 409])
      const race = await find("race")
      expect(
        (await api().run.detail({ id: race.id })).filter(
          (e) =>
            e.type === "expectation_resolved" ||
            e.type === "expectation_cancelled",
        ),
      ).toHaveLength(1)
      await start("early-cancel")
      await send(cancel("early-cancel"))
      await send(declare("early-cancel"))
      const early = await find("early-cancel")
      expect(
        (await api().run.expectations({ id: early.id })).expectations[0],
      ).toMatchObject({
        state: "cancelled",
        cancelledAfterDeadline: false,
        outOfOrder: true,
      })
    })

    it("counts unmatched IDs toward the lifetime limit without blocking existing identities", async () => {
      await start("capacity")
      for (let i = 0; i < 100; i++) {
        expect((await send(resolve("capacity", `id-${i}`))).status).toBe(202)
      }
      expect(
        await (await send(declare("capacity", "new-101"))).json(),
      ).toMatchObject({ code: "EXPECTATION_LIMIT_REACHED" })
      expect((await send(declare("capacity", "id-0"))).status).toBe(202)
      expect(
        await (await send(resolve("capacity", "id-99"))).json(),
      ).toMatchObject({ disposition: "duplicate" })
      const run = await find("capacity"),
        view = await api().run.expectations({ id: run.id })
      expect(view.expectations).toHaveLength(1)
      expect(view.unmatched).toHaveLength(99)
    }, 20000)

    it("isolates credentials, canonical browser references and both same-ID project populations", async () => {
      await start("scoped")
      await send(declare("scoped"))
      const run = await find("scoped")
      const other = caller(foreign.cookie, foreign.project.id)
      expect(
        (await other.run.expectations({ id: run.id })).expectations,
      ).toEqual([])
      expect(
        (await send(resolve("scoped"), randomUUID(), foreign.writeKey.secret))
          .status,
      ).toBe(409)
      await send(
        { ...base("scoped"), type: "started" },
        randomUUID(),
        foreign.writeKey.secret,
      )
      await send(declare("scoped"), randomUUID(), foreign.writeKey.secret)
      await send(resolve("scoped"), randomUUID(), foreign.writeKey.secret)
      expect(
        (await api().run.expectations({ id: run.id })).expectations[0]?.state,
      ).toBe("pending")
      const key = await api().project.createBrowserKey({
        projectId: primary.project.id,
        name: "Test browser",
        origins: ["http://localhost:5173"],
      })
      const browserSend = (event: unknown) =>
        browserPOST(
          new Request("http://localhost/v1/browser-events", {
            method: "POST",
            headers: {
              authorization: `Bearer ${key.secret}`,
              origin: "http://localhost:5173",
            },
            body: JSON.stringify({ eventId: randomUUID(), event }),
          }),
        )
      expect((await browserSend(resolve("scoped"))).status).toBe(403)
      expect(
        (await browserSend({ ...base("browser-ref"), type: "started" })).status,
      ).toBe(202)
      expect((await browserSend(declare("browser-ref"))).status).toBe(202)
      expect(
        (
          await browserSend({
            ...resolve("browser-ref"),
            workflow: "browser.booking.expectations",
            source: "server",
          })
        ).status,
      ).toBe(202)
      const browserRun = await find(
        "browser-ref",
        "browser.booking.expectations",
      )
      expect(
        (await api().run.expectations({ id: browserRun.id })).expectations[0],
      ).toMatchObject({ source: "browser", state: "met-on-time" })
    })

    it("uses full-cohort distinct-run/expectation denominators beyond the first 100 runs", async () => {
      clock.value = "2026-10-31T12:00:00.000Z"
      const workflow = "expectation.population",
        workflowId = randomUUID()
      await connection.db.insert(workflows).values({
        id: workflowId,
        projectId: primary.project.id,
        name: workflow,
      })
      const runs = Array.from({ length: 150 }, (_, i) => ({
        id: randomUUID(),
        workflowId,
        externalId: `population-${i}`,
        startedAt: new Date(Date.parse(clock.value) - i * 1000),
      }))
      await connection.db.insert(workflowRuns).values(runs)
      await connection.db.insert(workflowEvents).values(
        runs.map((run) => ({
          eventId: randomUUID(),
          runId: run.id,
          type: "started" as const,
          occurredAt: run.startedAt,
        })),
      )
      for (let i = 127; i < 150; i++) {
        for (let n = 0; n < (i < 135 ? 2 : 1); n++) {
          expect(
            (
              await send({
                ...declare(runs[i]!.externalId, `confirmation-${n}`, 60000),
                workflow,
              })
            ).status,
          ).toBe(202)
        }
      }
      await connection.db.insert(workflowEvents).values(
        runs.map((run) => ({
          eventId: randomUUID(),
          runId: run.id,
          type: "completed" as const,
          occurredAt: new Date(clock.value),
        })),
      )
      clock.value = "2026-10-31T12:06:00.000Z"
      const input = {
        workflow,
        startedAfter: "2026-10-31T00:00:00Z",
        startedBefore: clock.value,
        limit: 10,
      }
      const list = await api().run.list({
        ...input,
        expectationState: "overdue",
      })
      expect(list.total).toBe(23)
      expect(list.runs).toHaveLength(10)
      expect(list.attention).toMatchObject({
        totalRuns: 150,
        overdueRuns: 23,
        overdueExpectations: 31,
      })
      const next = await api().run.list({
        ...input,
        expectationState: "overdue",
        cursor: list.nextCursor!,
      })
      expect(next.runs).toHaveLength(10)
      expect(
        next.runs.some((r) => list.runs.some((first) => first.id === r.id)),
      ).toBe(false)
      expect(
        (
          await api().run.list({
            ...input,
            status: "Failed",
            expectationState: "overdue",
          })
        ).attention,
      ).toMatchObject({ totalRuns: 0, overdueRuns: 0 })
      await send({
        ...cancel(runs[149]!.externalId, "confirmation-0"),
        workflow,
      })
      await send({
        ...resolve(runs[148]!.externalId, "confirmation-0"),
        workflow,
      })
      expect(
        (await api().run.list({ ...input, expectationState: "overdue" }))
          .attention,
      ).toMatchObject({
        totalRuns: 150,
        overdueRuns: 21,
        overdueExpectations: 29,
      })
      expect(
        (await api().run.list({ ...input, expectationState: "met-late" }))
          .total,
      ).toBe(1)
      await expect(
        api().run.list({
          ...input,
          expectationState: "overdue",
          startedAfter: "2020-01-01T00:00:00Z",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    }, 20000)

    it("removes owned expectation identifiers with expired canonical evidence without touching the run terminal", async () => {
      await start("retention")
      await send(declare("retention"))
      await send(declare("retention"))
      await send(resolve("retention"))
      await send({
        ...base("retention"),
        type: "completed",
        outcome: "submitted",
        result: { submitted: 1 },
      })
      const run = await find("retention"),
        [projection] = await connection.db
          .select()
          .from(workflowExpectations)
          .where(eq(workflowExpectations.runId, run.id))
      await connection.db
        .delete(workflowEvents)
        .where(eq(workflowEvents.id, projection!.declarationEventId!))
      expect(
        await connection.db
          .select()
          .from(workflowExpectations)
          .where(eq(workflowExpectations.runId, run.id)),
      ).toHaveLength(0)
      expect(
        (await api().run.detail({ id: run.id })).filter((e) => e.expectation),
      ).toHaveLength(0)
      expect(await find("retention")).toMatchObject({
        status: "Completed",
        outcome: "submitted",
        result: { submitted: 1 },
      })
    })
  },
)
