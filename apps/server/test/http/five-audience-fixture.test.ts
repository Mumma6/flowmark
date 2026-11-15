import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, projectMembers } from "@flowmark/db"
import { appRouter } from "../../src/adapters/trpc/router"
import { resetAuthCacheForTests } from "../../src/auth"
import { POST } from "../../app/v1/events/route"
import { POST as readPeriod } from "../../app/v1/read/period/route"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

const execute = <A, E>(operation: Effect.Effect<A, E>) =>
  Effect.runPromise(operation)
const origin = "http://localhost:3001"
const booking = "synthetic.booking"
const notify = "synthetic.notify"
const referral = "synthetic.referral"
const canary = "PRIVATE_DIAGNOSTIC_CANARY"
const bookingRef = "SYN-BOOK-RECENT"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "five audiences over one synthetic process family",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_URL", origin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", origin)
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
      resetAuthCacheForTests()
    })
    const caller = (cookie: string, projectId: string) =>
      appRouter.createCaller({
        request: new Request(`${origin}/api/trpc`, {
          headers: { cookie, origin, "x-flowmark-project-id": projectId },
        }),
      })

    it("answers each audience from the same permitted evidence", async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      resetAuthCacheForTests()
      const owner = await execute(createDefinitionImportFixture(connection.db))
      const sales = await execute(createDefinitionImportFixture(connection.db))
      const engineering = await execute(
        createDefinitionImportFixture(connection.db),
      )
      const stranger = await execute(
        createDefinitionImportFixture(connection.db),
      )
      await connection.db.insert(projectMembers).values([
        { userId: sales.userId, projectId: owner.projectId, role: "business" },
        {
          userId: engineering.userId,
          projectId: owner.projectId,
          role: "viewer",
        },
      ])
      const admin = caller(owner.cookie, owner.projectId)
      const business = caller(sales.cookie, owner.projectId)
      const diagnostic = caller(engineering.cookie, owner.projectId)
      const outsider = caller(stranger.cookie, owner.projectId)
      const declare = (workflow: string) =>
        admin.resultDeclarations.create({
          projectId: owner.projectId,
          workflow,
          declaration: {
            revision: "v1",
            fields: [
              {
                path: ["submitted"],
                label: "Reported submissions",
                kind: "count",
                unit: "submissions",
                aggregate: true,
              },
              {
                path: ["accepted"],
                label: "Reported accepted records",
                kind: "count",
                aggregate: true,
              },
            ],
          },
        })
      await declare(booking)
      await declare(notify)
      await declare(referral)
      await admin.resultDeclarations.setSearchFields({
        projectId: owner.projectId,
        workflow: booking,
        fields: [{ key: "bookingRef", role: "lookup" }],
      })
      await admin.resultDeclarations.setSearchFields({
        projectId: owner.projectId,
        workflow: notify,
        fields: [{ key: "bookingRef", role: "lookup" }],
      })
      await admin.businessEvidence.replace({
        projectId: owner.projectId,
        expectedRevision: 0,
        publication: {
          results: [
            { workflow: booking, revision: "v1", paths: [["submitted"]] },
            { workflow: notify, revision: "v1", paths: [["submitted"]] },
          ],
          references: [
            { workflow: booking, keys: ["bookingRef"] },
            { workflow: notify, keys: ["bookingRef"] },
          ],
        },
      })
      const send = async (event: object) => {
        const response = await POST(
          new Request("http://localhost/v1/events", {
            method: "POST",
            headers: {
              authorization: `Bearer ${owner.writeKey}`,
              "x-flowmark-expectations": "v1",
            },
            body: JSON.stringify({ eventId: randomUUID(), event }),
          }),
        )
        expect(response.status).toBe(202)
      }
      const start = (
        workflow: string,
        runId: string,
        timestamp: string,
        extra: object = {},
      ) =>
        send({
          type: "started",
          workflow,
          runId,
          timestamp,
          release: "synthetic-release",
          environment: "synthetic",
          properties: {
            synthetic: true,
            definitionRevision: "v1",
            bookingRef,
            provider: "orbit-scheduling",
          },
          ...extra,
        })
      await start(booking, "book-previous", "2026-11-09T12:00:00.000Z")
      await send({
        type: "completed",
        workflow: booking,
        runId: "book-previous",
        timestamp: "2026-11-09T12:01:00.000Z",
        outcome: "confirmed",
        result: { submitted: 1, privateNote: canary },
      })
      await start(booking, "book-partial", "2026-11-10T12:00:00.000Z")
      await send({
        type: "expectation_declared",
        workflow: booking,
        runId: "book-partial",
        timestamp: "2026-11-10T12:00:00.000Z",
        expectationId: "confirmation",
        name: "provider-response",
        withinMs: 3_600_000,
      })
      await send({
        type: "expectation_resolved",
        workflow: booking,
        runId: "book-partial",
        timestamp: "2026-11-10T12:01:00.000Z",
        expectationId: "confirmation",
        outcome: "confirmed",
      })
      await send({
        type: "completed",
        workflow: booking,
        runId: "book-partial",
        timestamp: "2026-11-10T12:02:00.000Z",
        outcome: "partial",
        result: { submitted: 1, privateNote: canary },
      })
      await start(booking, "book-late", "2026-11-10T13:00:00.000Z")
      await send({
        type: "expectation_declared",
        workflow: booking,
        runId: "book-late",
        timestamp: "2026-11-10T13:00:00.000Z",
        expectationId: "confirmation",
        name: "provider-response",
        withinMs: 1,
      })
      await send({
        type: "expectation_resolved",
        workflow: booking,
        runId: "book-late",
        timestamp: "2026-11-10T14:00:00.000Z",
        expectationId: "confirmation",
        outcome: "confirmed",
      })
      await start(booking, "book-missing", "2026-11-12T12:00:00.000Z")
      await send({
        type: "expectation_declared",
        workflow: booking,
        runId: "book-missing",
        timestamp: "2026-11-12T12:00:00.000Z",
        expectationId: "confirmation",
        name: "provider-response",
        withinMs: 1,
      })
      await start(booking, "book-cancelled", "2026-11-10T15:00:00.000Z")
      await send({
        type: "expectation_declared",
        workflow: booking,
        runId: "book-cancelled",
        timestamp: "2026-11-10T15:00:00.000Z",
        expectationId: "confirmation",
        name: "provider-response",
        withinMs: 3_600_000,
      })
      await send({
        type: "expectation_cancelled",
        workflow: booking,
        runId: "book-cancelled",
        timestamp: "2026-11-10T15:05:00.000Z",
        expectationId: "confirmation",
        code: "BOOKING_CANCELLED",
      })
      await start(booking, "book-retry", "2026-11-10T16:00:00.000Z", {
        retryOf: { workflow: booking, runId: "book-partial" },
      })
      await send({
        type: "failed",
        workflow: booking,
        runId: "book-retry",
        timestamp: "2026-11-10T16:01:00.000Z",
        failure: { code: "SYNTHETIC_PROVIDER_DOWN", message: canary },
      })
      await start(referral, "referral-batch", "2026-11-10T11:00:00.000Z")
      await send({
        type: "completed",
        workflow: referral,
        runId: "referral-batch",
        timestamp: "2026-11-10T11:01:00.000Z",
        outcome: "partial",
        result: { accepted: 4, submitted: 4, privateNote: canary },
      })
      await start(notify, "notify-sample", "2026-11-10T16:30:00.000Z", {
        parentRunId: "book-partial",
      })
      await send({
        type: "completed",
        workflow: notify,
        runId: "notify-sample",
        timestamp: "2026-11-10T16:31:00.000Z",
        outcome: "delivered",
        result: { submitted: 1 },
      })

      const partial = (
        await diagnostic.run.list({
          workflow: booking,
          externalId: "book-partial",
        })
      ).runs[0]!
      const retry = (
        await diagnostic.run.list({
          workflow: booking,
          externalId: "book-retry",
        })
      ).runs[0]!
      expect(partial.outcome).toBe("partial")
      expect(retry.status).toBe("Failed")
      expect(
        JSON.stringify(await diagnostic.run.detail({ id: retry.id })),
      ).toContain("book-partial")
      const states = async (
        expectationState: "met-on-time" | "met-late" | "overdue" | "cancelled",
      ) =>
        (
          await diagnostic.run.list({
            workflow: booking,
            expectationState,
          })
        ).runs.map((item) => item.externalId)
      expect(await states("met-on-time")).toEqual(["book-partial"])
      expect(await states("met-late")).toEqual(["book-late"])
      expect(await states("overdue")).toEqual(["book-missing"])
      expect(await states("cancelled")).toEqual(["book-cancelled"])
      const related = await diagnostic.run.relatedPage({ runId: partial.id })
      expect(related.totalLinks).toBe(1)
      expect(related.totalLinks).not.toBe(4)

      const period = {
        workflow: booking,
        currentStartedAfter: "2026-11-10T00:00:00.000Z",
        currentStartedBefore: "2026-11-11T00:00:00.000Z",
        previousStartedAfter: "2026-11-09T00:00:00.000Z",
        previousStartedBefore: "2026-11-10T00:00:00.000Z",
      }
      const studio = await diagnostic.project.periodReport(period)
      expect(studio.current).toMatchObject({
        totalRuns: 4,
        finishedRuns: 2,
        failedRuns: 1,
        completedRuns: 1,
      })
      expect(studio.current.totalRuns - studio.current.finishedRuns).toBe(2)
      expect(studio.previous).toMatchObject({
        totalRuns: 1,
        finishedRuns: 1,
        failedRuns: 0,
        completedRuns: 1,
      })
      const published = await readPeriod(
        new Request("http://127.0.0.1/v1/read/period", {
          method: "POST",
          headers: {
            authorization: `Bearer ${owner.readKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            version: 1,
            kind: "period",
            projectId: owner.projectId,
            ...period,
          }),
        }),
      )
      expect(published.status).toBe(200)
      const publicPeriod = (await published.json()) as {
        report: {
          current: { totalRuns: number; failedRuns: number }
          previous: { totalRuns: number; failedRuns: number }
        }
      }
      expect(publicPeriod.report.current.totalRuns).toBe(
        studio.current.totalRuns,
      )
      expect(publicPeriod.report.current.failedRuns).toBe(
        studio.current.failedRuns,
      )
      expect(publicPeriod.report.previous.totalRuns).toBe(
        studio.previous.totalRuns,
      )

      const salesView = await business.businessEvidence.read({
        kind: "run",
        runId: partial.id,
      })
      expect(salesView.data).toMatchObject({
        fields: [
          {
            label: "Reported submissions",
            unit: "submissions",
            value: 1,
          },
        ],
        references: [{ key: "bookingRef", value: bookingRef }],
      })
      const salesText = JSON.stringify(salesView)
      expect(salesText).not.toContain(canary)
      expect(salesText).not.toContain(owner.writeKey)
      expect(salesText).not.toContain("revenue")
      const journey = await business.businessEvidence.read({
        kind: "journey",
        query: {
          workflow: booking,
          key: "bookingRef",
          value: bookingRef,
          namespaces: [
            { workflow: booking, key: "bookingRef" },
            { workflow: notify, key: "bookingRef" },
          ],
        },
      })
      expect(journey.data).toMatchObject({
        kind: "journey",
        state: "Ambiguous",
        value: bookingRef,
      })
      const journeyText = JSON.stringify(journey.data)
      expect(journeyText).toContain(
        "downstream sampling is not a complete funnel",
      )
      expect(journeyText).not.toContain(canary)
      if (journey.data.kind !== "journey") {
        throw new Error("Expected a journey projection")
      }
      expect(journey.data.candidates.length).toBeGreaterThan(1)
      expect(journey.data.candidates.length).not.toBe(4)
      expect(
        journey.data.candidates.every((item) => item.workflow === booking),
      ).toBe(true)
      const saved = await business.investigations.save({
        projectId: owner.projectId,
        command: {
          title: "Synthetic booking question",
          selection: {
            version: 1,
            kind: "run",
            projectId: owner.projectId,
            runId: partial.id,
            section: "events",
          },
        },
      })
      expect(
        await business.investigations.get({
          projectId: owner.projectId,
          id: saved.id,
        }),
      ).toMatchObject({ selection: { runId: partial.id } })
      await expect(business.run.detail({ id: partial.id })).rejects.toThrow()
      await expect(
        outsider.businessEvidence.read({ kind: "run", runId: partial.id }),
      ).rejects.toThrow()

      const directory = await mkdtemp(join(tmpdir(), "flowmark-audience-"))
      try {
        const input = join(directory, "selection.json")
        const output = join(directory, "evidence.json")
        await writeFile(
          input,
          JSON.stringify({
            version: 1,
            kind: "run",
            section: "events",
            projectId: owner.projectId,
            runId: partial.id,
          }),
        )
        const { POST: readRun } = await import("../../app/v1/read/run/route")
        const live = await createServerFor(readRun)
        const { stdout } = await promisify(execFile)(
          "pnpm",
          [
            "--filter",
            "@flowmark/db",
            "exec",
            "tsx",
            "--tsconfig",
            "../../examples/tsconfig.json",
            "../../examples/read-run.ts",
            input,
            "--snapshot",
            output,
          ],
          {
            cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
            env: {
              ...process.env,
              FLOWMARK_API_URL: live.origin,
              FLOWMARK_READ_KEY: owner.readKey,
            },
          },
        )
        const snapshot = JSON.parse(await readFile(output, "utf8")) as {
          status: string
          evidenceNote: string
        }
        expect(snapshot.status).toBe("Completed")
        expect(snapshot.evidenceNote).toContain(owner.projectId)
        expect(snapshot.evidenceNote).toContain(partial.id)
        expect(snapshot.evidenceNote + stdout).not.toContain(canary)
        expect(snapshot.evidenceNote + stdout).not.toContain(owner.writeKey)
        await live.close()
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }, 30000)
  },
)

const createServerFor = async (
  handler: (request: Request) => Promise<Response> | Response,
) => {
  const { createServer } = await import("node:http")
  const { Readable } = await import("node:stream")
  const server = createServer((incoming, outgoing) => {
    const request = new Request(`http://127.0.0.1${incoming.url}`, {
      method: incoming.method,
      headers: incoming.headers as HeadersInit,
      body: Readable.toWeb(incoming) as ReadableStream<Uint8Array>,
      duplex: "half",
    } as RequestInit)
    void Promise.resolve(handler(request))
      .then(async (response) => {
        outgoing.writeHead(
          response.status,
          Object.fromEntries(response.headers),
        )
        outgoing.end(Buffer.from(await response.arrayBuffer()))
      })
      .catch(() => outgoing.destroy())
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Missing test port")
  }
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}
