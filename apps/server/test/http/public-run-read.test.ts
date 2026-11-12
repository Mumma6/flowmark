import { createServer, type Server } from "node:http"
import { Readable } from "node:stream"
import { createHash, randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Effect, Exit } from "effect"
import { eq, sql } from "drizzle-orm"
import {
  createDatabase,
  workspaces,
  projects,
  workflows,
  workflowRuns,
  workflowEvents,
  projectMembers,
  user,
  authRateLimits,
} from "@flowmark/db"
import { ManageProject, GetProjectWorkflowData, runApi } from "@flowmark/api"
import {
  createFlowmarkReadClient,
  type RunReadInput,
} from "../../../../packages/sdk/src/reads/index.js"
import { POST } from "../../app/v1/read/run/route"
import { POST as readPeriodPost } from "../../app/v1/read/period/route"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "public run read over HTTP, SDK and disposable PostgreSQL",
  () => {
    const workspaceId = randomUUID(),
      projectId = randomUUID(),
      foreignProject = randomUUID(),
      workflowId = randomUUID(),
      otherWorkflow = randomUUID(),
      runId = randomUUID(),
      emptyRun = randomUUID(),
      foreignRun = randomUUID(),
      userId = randomUUID()
    const input: RunReadInput = {
      version: 1,
      kind: "run",
      section: "events",
      projectId,
      runId,
      limit: 1,
    }
    const events = [randomUUID(), randomUUID(), randomUUID()].sort()
    let connection: ReturnType<typeof createDatabase>
    let server: Server,
      origin: string,
      readKey: string,
      readId: string,
      writeKey: string
    const api = async <A, E>(operation: Parameters<typeof runApi<A, E>>[0]) => {
      const result = await runApi(operation)
      if (Exit.isFailure(result)) {
        throw new Error("Test API operation failed")
      }
      return result.value
    }
    const raw = (body: unknown, key = readKey) =>
      fetch(`${origin}/v1/read/run`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
      })

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const db = connection.db
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Public-read disposable fixture" })
      await db.insert(projects).values([
        { id: projectId, workspaceId, name: "Read scope" },
        { id: foreignProject, workspaceId, name: "Foreign scope" },
      ])
      await db.insert(user).values({
        id: userId,
        name: "Read fixture",
        email: `${userId}@example.test`,
      })
      await db
        .insert(projectMembers)
        .values({ projectId, userId, role: "owner" })
      const created = await api(
        Effect.flatMap(ManageProject, (manage) =>
          manage.createReadKey(userId, projectId, "Public client"),
        ),
      )
      readKey = created.secret
      readId = created.id
      writeKey = (
        await api(
          Effect.flatMap(ManageProject, (manage) =>
            manage.createWriteKey(userId, projectId, "Ingestion"),
          ),
        )
      ).secret
      await db.insert(workflows).values([
        { id: workflowId, projectId, name: "public.read" },
        { id: otherWorkflow, projectId: foreignProject, name: "foreign.read" },
      ])
      await db.insert(workflowRuns).values([
        {
          id: runId,
          workflowId,
          externalId: "run",
          startedAt: new Date("2026-11-10T00:00:00Z"),
        },
        {
          id: emptyRun,
          workflowId,
          externalId: "empty",
          startedAt: new Date("2026-11-10T00:00:00Z"),
        },
        {
          id: foreignRun,
          workflowId: otherWorkflow,
          externalId: "foreign",
          startedAt: new Date("2026-11-10T00:00:00Z"),
        },
      ])
      await db.execute(sql`INSERT INTO workflow_events (event_id, run_id, type, occurred_at, created_at, properties)
      VALUES (${events[0]}::uuid, ${runId}::uuid, 'started', '2026-11-10T00:00:00.123456Z', '2026-11-10T00:00:01.123456Z', ${JSON.stringify({ marker: "PRIVATE-LARGE-PAYLOAD".repeat(100000) })}::jsonb),
      (${events[1]}::uuid, ${runId}::uuid, 'progress', '2026-11-10T00:00:00.123456Z', '2026-11-10T00:00:01.123456Z', '{}'),
      (${events[2]}::uuid, ${runId}::uuid, 'completed', '2026-11-10T00:01:00.123457Z', '2026-11-10T00:01:01.123457Z', '{}')`)
      server = createServer((incoming, outgoing) => {
        const abort = new AbortController()
        outgoing.on("close", () => {
          if (!outgoing.writableEnded) {
            abort.abort()
          }
        })
        const request = new Request(`http://127.0.0.1${incoming.url}`, {
          method: incoming.method,
          headers: incoming.headers as HeadersInit,
          body: Readable.toWeb(incoming) as ReadableStream<Uint8Array>,
          duplex: "half",
          signal: abort.signal,
        } as RequestInit)
        void (
          incoming.url?.startsWith("/v1/read/period")
            ? readPeriodPost(request)
            : POST(request)
        )
          .then(async (response) => {
            outgoing.writeHead(
              response.status,
              Object.fromEntries(response.headers),
            )
            outgoing.end(Buffer.from(await response.arrayBuffer()))
          })
          .catch(() => outgoing.destroy())
      })
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      )
      const address = server.address()
      if (!address || typeof address === "string") {
        throw new Error("Missing test port")
      }
      origin = `http://127.0.0.1:${address.port}`
    })
    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("issues only member-owned read keys; reproduces Studio summary and metadata pages without raw JSON", async () => {
      const client = createFlowmarkReadClient({ apiBaseUrl: origin, readKey })
      const first = await client.readRun(input)
      const studio = await api(
        Effect.flatMap(GetProjectWorkflowData, (data) =>
          data.runInvestigationSummary(
            { _tag: "Key", header: `Bearer ${readKey}` },
            runId,
          ),
        ),
      )
      expect(first.summary).toMatchObject({
        id: studio.id,
        workflow: studio.workflow,
        status: studio.status,
        durationMs: studio.durationMs,
        eventCount: studio.eventCount,
      })
      expect(first.page.events[0].id).toBe(events[0])
      expect(first.page.nextCursor).toContain(".123456Z")
      expect(JSON.stringify(first)).not.toContain("PRIVATE-LARGE-PAYLOAD")
      expect(Object.keys(first.page.events[0]).sort()).toEqual([
        "durationMs",
        "id",
        "timestamp",
        "type",
      ])
      const second = await client.readRun({
        ...input,
        cursor: first.page.nextCursor!,
      })
      expect(second.page.events[0].id).toBe(events[1])
      const third = await client.readRun({
        ...input,
        cursor: second.page.nextCursor!,
      })
      expect(third.page.events[0].id).toBe(events[2])
      expect(third.page.nextCursor).toBeNull()
      const empty = await client.readRun({ ...input, runId: emptyRun })
      expect(empty.page).toEqual({
        events: [],
        limit: 1,
        totalEvents: 0,
        nextCursor: null,
      })
      const denied = await runApi(
        Effect.flatMap(ManageProject, (manage) =>
          manage.createReadKey(randomUUID(), projectId, "denied"),
        ),
      )
      expect(Exit.isFailure(denied)).toBe(true)
    })

    it("denies write/session/MCP authority, foreign project/run and foreign or altered cursors", async () => {
      expect((await raw(input, writeKey)).status).toBe(401)
      expect((await raw(input, "oauth-token")).status).toBe(401)
      expect(
        (
          await fetch(`${origin}/v1/read/run`, {
            method: "POST",
            body: JSON.stringify(input),
            headers: {
              "Content-Type": "application/json",
              Cookie: "session=unverified",
              "x-flowmark-user-id": userId,
            },
          })
        ).status,
      ).toBe(401)
      expect((await raw({ ...input, projectId: foreignProject })).status).toBe(
        403,
      )
      expect((await raw({ ...input, runId: foreignRun })).status).toBe(404)
      expect((await raw({ ...input, runId: randomUUID() })).status).toBe(404)
      const first = await (await raw(input)).json()
      expect(
        (
          await raw({
            ...input,
            runId: emptyRun,
            cursor: first.page.nextCursor,
          })
        ).status,
      ).toBe(400)
      expect(
        (
          await raw({
            ...input,
            cursor: first.page.nextCursor.replace("123456", "123455"),
          })
        ).status,
      ).toBe(400)
      expect(
        (await raw({ ...input, cursor: "bad|cursor|not-a-uuid" })).status,
      ).toBe(400)
      await connection.db
        .delete(workflowEvents)
        .where(eq(workflowEvents.eventId, events[0]))
      expect(
        (await raw({ ...input, cursor: first.page.nextCursor })).status,
      ).toBe(400)
    })

    it("runs the standalone consumer with environment-only key configuration", async () => {
      const directory = await mkdtemp(join(tmpdir(), "flowmark-read-cli-"))
      const file = join(directory, "selection.json")
      await writeFile(file, JSON.stringify({ ...input, runId: emptyRun }))
      try {
        const root = fileURLToPath(new URL("../../../../", import.meta.url))
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
            file,
          ],
          {
            cwd: root,
            env: {
              ...process.env,
              FLOWMARK_API_URL: origin,
              FLOWMARK_READ_KEY: readKey,
              FLOWMARK_STUDIO_URL: "https://studio.example/self-host/",
            },
          },
        )
        expect(stdout).toContain("No retained events on this page.")
        expect(stdout).toContain("https://studio.example/self-host/runs/")
        expect(stdout).not.toContain(readKey)
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    })

    it("compares technical periods against Studio over a scoped population without loading large attribution sections", async () => {
      const previous = randomUUID(),
        failed = randomUUID(),
        outside = randomUUID()
      await connection.db.insert(workflowRuns).values([
        {
          id: previous,
          workflowId,
          externalId: "previous",
          startedAt: new Date("2026-11-09T12:00:00Z"),
        },
        {
          id: failed,
          workflowId,
          externalId: "failed",
          startedAt: new Date("2026-11-10T12:00:00Z"),
        },
        {
          id: outside,
          workflowId,
          externalId: "outside",
          startedAt: new Date("2026-11-11T00:00:00Z"),
        },
      ])
      await connection.db
        .execute(sql`INSERT INTO workflow_events (event_id, run_id, type, occurred_at) VALUES
        (${randomUUID()}::uuid, ${previous}::uuid, 'completed', '2026-11-09T12:01:00Z'),
        (${randomUUID()}::uuid, ${failed}::uuid, 'failed', '2026-11-10T12:02:00Z'),
        (${randomUUID()}::uuid, ${outside}::uuid, 'completed', '2026-11-11T00:01:00Z')`)
      await connection.db
        .execute(sql`INSERT INTO workflow_events (event_id, run_id, type, occurred_at, operation_name, duration_ms)
        SELECT gen_random_uuid(), ${runId}::uuid, 'operation_completed', '2026-11-10T00:01:30Z'::timestamptz,
          repeat('LARGE-ATTRIBUTION-', 100) || number, 1 FROM generate_series(1, 120) number`)
      await connection.db
        .update(workflows)
        .set({ name: "public.read" })
        .where(eq(workflows.id, otherWorkflow))
      const period = {
        version: 1,
        kind: "period",
        projectId,
        workflow: "public.read",
        currentStartedAfter: "2026-11-10T00:00:00.000Z",
        currentStartedBefore: "2026-11-11T00:00:00.000Z",
        previousStartedAfter: "2026-11-09T00:00:00.000Z",
        previousStartedBefore: "2026-11-10T00:00:00.000Z",
      } as const
      const client = createFlowmarkReadClient({ apiBaseUrl: origin, readKey })
      const result = await client.readPeriod(period)
      const studio = await api(
        Effect.flatMap(GetProjectWorkflowData, (data) =>
          data.periodReport(
            { _tag: "Key", header: `Bearer ${readKey}` },
            period,
          ),
        ),
      )
      const canonical = (value: typeof studio.current) => ({
        startedAfter: new Date(value.startedAfter).toISOString(),
        startedBefore: new Date(value.startedBefore).toISOString(),
        totalRuns: value.totalRuns,
        finishedRuns: value.finishedRuns,
        completedRuns: value.completedRuns,
        failedRuns: value.failedRuns,
        successRate: value.successRate,
        medianDurationMs: value.medianDurationMs,
        p95DurationMs: value.p95DurationMs,
      })
      expect(result.report.current).toEqual(canonical(studio.current))
      expect(result.report.previous).toEqual(canonical(studio.previous))
      expect(result.report.current).toMatchObject({
        totalRuns: 3,
        finishedRuns: 2,
        failedRuns: 1,
        completedRuns: 1,
      })
      expect(result.report.previous).toMatchObject({
        totalRuns: 1,
        finishedRuns: 1,
        failedRuns: 0,
      })
      expect(result.coverage).toMatchObject({
        currentOpenRuns: 1,
        previousOpenRuns: 0,
        previousWindowHasRuns: true,
        durationObservationCounts: null,
      })
      expect(result.continuation).toBeNull()
      expect(studio.operations.length).toBe(120)
      expect(JSON.stringify(result)).not.toContain("LARGE-ATTRIBUTION")
      expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(8192)
      const href = new URL(result.evidence.periodPath, "https://studio.example")
      expect(JSON.parse(href.searchParams.get("selection")!)).toEqual(period)
      expect(href.searchParams.get("startedBeforeExclusive")).toBe(
        period.currentStartedBefore,
      )
      const empty = await client.readPeriod({ ...period, workflow: "missing" })
      expect(empty.report.current.totalRuns).toBe(0)
      expect(empty.report.current.successRate).toBeNull()
      expect(empty.coverage.previousWindowHasRuns).toBe(false)

      const dir = await mkdtemp(join(tmpdir(), "flowmark-period-cli-"))
      try {
        const file = join(dir, "selection.json")
        await writeFile(file, JSON.stringify(period))
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
            file,
          ],
          {
            cwd: fileURLToPath(new URL("../../../../", import.meta.url)),
            env: {
              ...process.env,
              FLOWMARK_API_URL: origin,
              FLOWMARK_READ_KEY: readKey,
            },
          },
        )
        expect(stdout).toContain('"mode": "technical"')
        expect(stdout).toContain('"failedRuns": 1')
        expect(stdout).not.toContain(readKey)
      } finally {
        await rm(dir, { recursive: true, force: true })
      }
    })

    it("denies unsupported period revisions, mixed filters and foreign scope over HTTP", async () => {
      const period = {
        version: 1,
        kind: "period",
        projectId,
        workflow: "public.read",
        currentStartedAfter: "2026-11-10T00:00:00.000Z",
        currentStartedBefore: "2026-11-11T00:00:00.000Z",
        previousStartedAfter: "2026-11-09T00:00:00.000Z",
        previousStartedBefore: "2026-11-10T00:00:00.000Z",
      }
      const read = (value: unknown, key = readKey) =>
        fetch(`${origin}/v1/read/period`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify(value),
        })
      expect((await read(period, writeKey)).status).toBe(401)
      expect(
        (await read({ ...period, projectId: foreignProject })).status,
      ).toBe(403)
      const unsupported = await read({
        ...period,
        revision: "unknown",
        environment: "production",
      })
      expect(unsupported.status).toBe(400)
      expect((await unsupported.json()).error.code).toBe(
        "UNSUPPORTED_SELECTION",
      )
      expect(
        (
          await read({
            ...period,
            currentStartedBefore: "2027-01-01T00:00:00.000Z",
          })
        ).status,
      ).toBe(400)
    })

    it("enforces the durable key budget with Retry-After over HTTP", async () => {
      const key = createHash("sha256")
        .update(`flowmark:public-read:v1:key:${readKey}`)
        .digest("hex")
      await connection.db
        .update(authRateLimits)
        .set({ count: 120, expiresAt: new Date(Date.now() + 60000) })
        .where(eq(authRateLimits.key, key))
      const limited = await raw(input)
      expect(limited.status).toBe(429)
      expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0)
      await connection.db
        .update(authRateLimits)
        .set({ count: 0 })
        .where(eq(authRateLimits.key, key))
    })

    it("maps an actual PostgreSQL statement timeout to 504 and recovers after the lock is released", async () => {
      const key = createHash("sha256")
        .update(`flowmark:public-read:v1:key:${readKey}`)
        .digest("hex")
      await connection.db.transaction(async (transaction) => {
        await transaction.execute(
          sql`SELECT key FROM auth_rate_limits WHERE key = ${key} FOR UPDATE`,
        )
        const timedOut = await raw(input)
        expect(timedOut.status).toBe(504)
        expect((await timedOut.json()).error.code).toBe("READ_TIMEOUT")
      })
      expect((await raw(input)).status).toBe(200)
    }, 15000)

    it("revocation denies the next page immediately", async () => {
      await api(
        Effect.flatMap(ManageProject, (manage) =>
          manage.revokeApiKey(userId, projectId, readId),
        ),
      )
      expect((await raw(input)).status).toBe(401)
      expect(
        (
          await fetch(`${origin}/v1/read/period`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${readKey}`,
            },
            body: "{}",
          })
        ).status,
      ).toBe(401)
    })
  },
)
