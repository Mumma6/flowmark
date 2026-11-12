import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { Array, Effect, Option } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase } from "@flowmark/db"
import { Database, WorkflowStore } from "@flowmark/db/persistence"
import type {
  LinkedComparison,
  LinkedComparisonQuery,
  LinkedEvidenceRow,
  WorkflowEvent,
  WorkflowResult,
} from "@flowmark/api"
import { GET } from "../../app/api/trpc/[trpc]/route"
import { appRouter } from "../../src/adapters/trpc/router"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"
import { linkedAggregateSql } from "../../../../packages/db/src/persistence/workflows/sql/linked-comparison"

const base: LinkedComparisonQuery = {
  upstreamWorkflow: "patient.match",
  upstreamRevision: "v1",
  downstreamWorkflow: "appointment.book",
  downstreamRevision: "v1",
  numerator: ["confirmed"],
  denominator: ["requested"],
  currentStartedAfter: "2026-10-08T00:00:00.000Z",
  currentStartedBefore: "2026-10-15T00:00:00.000Z",
  previousStartedAfter: "2026-10-01T00:00:00.000Z",
  previousStartedBefore: "2026-10-08T00:00:00.000Z",
  releaseA: "old",
  releaseB: "new",
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "linked execution comparison population",
  () => {
    let connection: ReturnType<typeof createDatabase>
    let fixture: Effect.Success<
      ReturnType<typeof createDefinitionImportFixture>
    >
    let store: Effect.Success<typeof WorkflowStore.make>
    const owner = () =>
      appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: {
            cookie: fixture.cookie,
            "x-flowmark-project-id": fixture.projectId,
          },
        }),
      })
    const send = (event: WorkflowEvent, projectId = fixture.projectId) =>
      store.append(projectId, randomUUID(), event)
    const run = Effect.fn("test.linkedRun")(function* (
      workflow: string,
      runId: string,
      options: {
        readonly timestamp?: string
        readonly parentRunId?: string
        readonly revision?: string
        readonly provider?: string
        readonly release?: string
        readonly result?: WorkflowResult
        readonly failed?: boolean
        readonly open?: boolean
        readonly projectId?: string
        readonly retryOf?: { workflow: string; runId: string }
      } = {},
    ) {
      const timestamp = options.timestamp ?? "2026-10-10T10:00:00.000Z"
      yield* send(
        {
          type: "started",
          workflow,
          runId,
          timestamp,
          properties: {
            definitionRevision: options.revision ?? "v1",
            provider: options.provider ?? "edge",
          },
          ...(options.parentRunId ? { parentRunId: options.parentRunId } : {}),
          ...(options.release ? { release: options.release } : {}),
          ...(options.retryOf ? { retryOf: options.retryOf } : {}),
        },
        options.projectId,
      )
      if (!options.open) {
        yield* send(
          {
            type: options.failed ? "failed" : "completed",
            workflow,
            runId,
            timestamp: new Date(Date.parse(timestamp) + 1000).toISOString(),
            ...(options.result ? { result: options.result } : {}),
          },
          options.projectId,
        )
      }
    })
    const child = (id: string, options: Parameters<typeof run>[2] = {}) =>
      run(base.downstreamWorkflow, `child-${id}`, {
        parentRunId: id,
        release: "new",
        result: { confirmed: 1, requested: 1 },
        ...options,
      })

    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!, {
        statementTimeoutMs: 10000,
      })
      fixture = await Effect.runPromise(
        createDefinitionImportFixture(connection.db),
      )
      store = await Effect.runPromise(
        WorkflowStore.make.pipe(Effect.provideService(Database, connection.db)),
      )
      await owner().resultDeclarations.create({
        projectId: fixture.projectId,
        workflow: base.upstreamWorkflow,
        declaration: { revision: "v1", fields: [] },
      })
      await owner().resultDeclarations.create({
        projectId: fixture.projectId,
        workflow: base.downstreamWorkflow,
        declaration: {
          revision: "v1",
          fields: [
            {
              path: ["confirmed"],
              label: "Reported confirmations",
              kind: "count",
              aggregate: true,
            },
            {
              path: ["requested"],
              label: "Reported requests",
              kind: "count",
              aggregate: true,
            },
          ],
        },
      })
      await owner().resultDeclarations.setSearchFields({
        projectId: fixture.projectId,
        workflow: base.upstreamWorkflow,
        fields: [
          {
            key: "provider",
            role: "dimension",
            values: ["known", "edge", "zero", "big", "micro"],
          },
        ],
      })
      await Effect.runPromise(
        Effect.forEach(["current", "previous"] as const, (scope) =>
          Effect.forEach(
            Array.range(0, 129),
            (index) =>
              Effect.gen(function* () {
                const id = `${scope}-${index}`
                const timestamp =
                  scope === "current"
                    ? "2026-10-10T10:00:00.000Z"
                    : "2026-10-03T10:00:00.000Z"
                yield* run(base.upstreamWorkflow, id, {
                  timestamp,
                  provider: "known",
                  ...(scope === "current" && index === 129
                    ? {
                        retryOf: {
                          workflow: base.upstreamWorkflow,
                          runId: "current-0",
                        },
                      }
                    : {}),
                })
                yield* child(id, {
                  timestamp,
                  release: scope === "current" ? "new" : "old",
                  failed: scope === "current" && index === 0,
                  result:
                    scope === "current"
                      ? {
                          confirmed: index % 2 === 0 ? 1 : 0,
                          requested: index % 2 === 0 ? 1 : 9,
                        }
                      : { confirmed: 1, requested: 2 },
                })
              }),
            { concurrency: 4 },
          ),
        ),
      )
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* run(base.upstreamWorkflow, "missing-1")
          yield* run(base.upstreamWorkflow, "missing-2")
          yield* run(base.upstreamWorkflow, "multiple")
          yield* child("multiple")
          yield* run(base.downstreamWorkflow, "child-retry", {
            parentRunId: "multiple",
            release: "new",
            revision: "v2",
            result: { confirmed: 100, requested: 100 },
            retryOf: {
              workflow: base.downstreamWorkflow,
              runId: "child-multiple",
            },
          })
          yield* run(base.upstreamWorkflow, "ambiguous")
          yield* run("other.process", "ambiguous")
          yield* child("ambiguous")
          yield* run(base.upstreamWorkflow, "upstream-revision", {
            revision: "v2",
          })
          yield* child("upstream-revision")
          yield* run(base.upstreamWorkflow, "downstream-revision")
          yield* child("downstream-revision", { revision: "v2" })
          yield* run(base.upstreamWorkflow, "open")
          yield* child("open", { open: true })
          yield* run(base.upstreamWorkflow, "no-result")
          yield* child("no-result", { result: undefined })
          yield* run(base.upstreamWorkflow, "no-metric")
          yield* child("no-metric", { result: { requested: 1 } })
          yield* run(base.upstreamWorkflow, "invalid")
          yield* child("invalid", { result: { confirmed: 1.5, requested: 2 } })
          yield* run(base.upstreamWorkflow, "wrong-release")
          yield* child("wrong-release", { release: "unexpected" })
          // The same external identity in another project cannot create ambiguity here.
          yield* run(base.upstreamWorkflow, "current-0", {
            projectId: fixture.foreignProjectId,
          })
        }),
      )
    }, 60000)
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    const scoped = (value: string): LinkedComparisonQuery => ({
      ...base,
      businessKey: "provider",
      businessValue: value,
    })
    const allPages: (
      query: LinkedComparisonQuery,
      coverage?: string,
      limit?: number,
      cursor?: string,
      collected?: readonly LinkedEvidenceRow[],
    ) => Effect.Effect<{ readonly rows: readonly LinkedEvidenceRow[] }> =
      Effect.fn("test.collectLinkedEvidence")(function* (
        query,
        coverage,
        limit = 25,
        cursor,
        collected = [],
      ) {
        const page = yield* Effect.promise(() =>
          owner().workflow.linkedEvidence({
            query,
            scope: "current",
            coverage,
            limit,
            cursor,
          }),
        )
        const rows = Array.appendAll(collected, page.rows)
        return page.nextCursor
          ? yield* allPages(query, coverage, limit, page.nextCursor, rows)
          : { rows }
      })

    it("computes weighted counts over the complete population and shows incompatible evidence", async () => {
      const response = await GET(
        new Request(
          `http://localhost:3001/api/trpc/workflow.linkedComparison?input=${encodeURIComponent(JSON.stringify(base))}`,
          { headers: { authorization: `Bearer ${fixture.readKey}` } },
        ),
      )
      expect(response.status).toBe(200)
      const report = (
        (await response.json()) as { result: { data: LinkedComparison } }
      ).result.data
      const current = Option.getOrThrow(
        Array.findFirst(report.windows, (window) => window.scope === "current"),
      )
      const previous = Option.getOrThrow(
        Array.findFirst(
          report.windows,
          (window) => window.scope === "previous",
        ),
      )
      expect(current).toMatchObject({
        anchors: 141,
        knownPairs: 130,
        numerator: "65",
        denominator: "650",
        ratio: 0.1,
        failedKnownPairs: 1,
        coverage: {
          missingLink: 2,
          multipleLinks: 1,
          ambiguousParent: 1,
          upstreamRevision: 1,
          downstreamRevision: 1,
          unfinished: 1,
          missingResult: 1,
          missingMetric: 1,
          invalidMetric: 1,
          releaseMismatch: 1,
          known: 130,
        },
      })
      expect(previous).toMatchObject({
        anchors: 130,
        knownPairs: 130,
        numerator: "130",
        denominator: "260",
        ratio: 0.5,
      })
      expect(
        Array.reduce(
          Object.values(current.coverage),
          0,
          (sum, count) => sum + count,
        ),
      ).toBe(current.anchors)
      expect(report.comparison).toMatchObject({
        available: false,
        reason: "Incompatible",
        delta: null,
      })
      const compatible = await owner().workflow.linkedComparison(
        scoped("known"),
      )
      expect(compatible.comparison).toMatchObject({
        available: true,
        delta: -0.4,
      })
      expect(compatible.numeratorLabel).toBe("Reported confirmations")
    }, 30000)

    it("pages every contributing attempt past 100 with matching coverage totals and isolated cursors", async () => {
      const query = scoped("known")
      const all = await Effect.runPromise(allPages(query, "known"))
      expect(all.rows).toHaveLength(130)
      expect(new Set(all.rows.map((row) => row.anchor.id)).size).toBe(130)
      expect(
        all.rows.some((row) => row.anchor.externalId === "current-129"),
      ).toBe(true)
      const first = await owner().workflow.linkedEvidence({
        query,
        scope: "current",
        coverage: "known",
        limit: 25,
      })
      expect(first.total).toBe(130)
      expect(first.nextCursor).not.toBeNull()
      await expect(
        owner().workflow.linkedEvidence({
          query,
          scope: "previous",
          coverage: "known",
          cursor: first.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        owner().workflow.linkedEvidence({
          query,
          scope: "current",
          coverage: "missingLink",
          cursor: first.nextCursor,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const forged = { ...JSON.parse(first.nextCursor!), id: randomUUID() }
      await expect(
        owner().workflow.linkedEvidence({
          query,
          scope: "current",
          coverage: "known",
          cursor: JSON.stringify(forged),
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const unknown = await owner().workflow.linkedEvidence({
        query: base,
        scope: "current",
        coverage: "multipleLinks",
      })
      expect(unknown.total).toBe(1)
      expect(unknown.rows[0]).toMatchObject({
        coverage: "multipleLinks",
        downstream: null,
        numerator: null,
        denominator: null,
      })
    }, 30000)

    it("preserves compact/fallback arithmetic and records a bounded representative query plan", async () => {
      const before = await owner().workflow.linkedComparison(scoped("known"))
      await connection.db.execute(
        sql`DELETE FROM workflow_run_facts f USING workflow_runs r, workflows w WHERE f.run_id = r.id AND r.workflow_id = w.id AND w.project_id = ${fixture.projectId}::uuid AND r.external_id IN ('current-0', 'child-current-0')`,
      )
      expect(await owner().workflow.linkedComparison(scoped("known"))).toEqual(
        before,
      )
      const plan = await connection.db.execute<Record<string, unknown>>(
        sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${linkedAggregateSql(fixture.projectId, scoped("known"))}`,
      )
      const explained = plan[0]?.["QUERY PLAN"] as [
        {
          Plan: { "Node Type": string; "Actual Rows": number }
          "Execution Time": number
        },
      ]
      expect(explained[0].Plan["Actual Rows"]).toBe(2)
      console.log("Linked comparison EXPLAIN ANALYZE", {
        node: explained[0].Plan["Node Type"],
        rows: explained[0].Plan["Actual Rows"],
        executionMs: explained[0]["Execution Time"],
      })
    }, 30000)

    it("keeps exact large sums, zero denominators and microsecond cursors explicit", async () => {
      await Effect.runPromise(
        Effect.forEach(["current", "previous"] as const, (scope) =>
          Effect.forEach(Array.range(0, 4), (index) =>
            Effect.gen(function* () {
              const timestamp =
                scope === "current"
                  ? "2026-10-11T10:00:00.000Z"
                  : "2026-10-04T10:00:00.000Z"
              yield* run(base.upstreamWorkflow, `big-${scope}-${index}`, {
                timestamp,
                provider: "big",
              })
              yield* child(`big-${scope}-${index}`, {
                timestamp,
                release: scope === "current" ? "new" : "old",
                result: {
                  confirmed: Number.MAX_SAFE_INTEGER,
                  requested: Number.MAX_SAFE_INTEGER,
                },
              })
              yield* run(base.upstreamWorkflow, `zero-${scope}-${index}`, {
                timestamp,
                provider: "zero",
              })
              yield* child(`zero-${scope}-${index}`, {
                timestamp,
                release: scope === "current" ? "new" : "old",
                result: { confirmed: 0, requested: 0 },
              })
            }),
          ),
        ),
      )
      const big = await owner().workflow.linkedComparison(scoped("big"))
      expect(
        big.windows.every(
          (window) =>
            window.numerator ===
              (5n * BigInt(Number.MAX_SAFE_INTEGER)).toString() &&
            window.ratio === 1,
        ),
      ).toBe(true)
      expect(
        (await owner().workflow.linkedComparison(scoped("zero"))).comparison,
      ).toMatchObject({
        available: false,
        reason: "ZeroDenominator",
        delta: null,
      })
      await Effect.runPromise(
        Effect.forEach(Array.range(1, 3), (index) =>
          run(base.upstreamWorkflow, `micro-${index}`, { provider: "micro" }),
        ),
      )
      await connection.db.execute(
        sql`UPDATE workflow_runs r SET started_at = '2026-10-10T10:00:00.000001Z'::timestamptz + (substring(r.external_id from 7)::int * interval '1 microsecond') FROM workflows w WHERE r.workflow_id = w.id AND w.project_id = ${fixture.projectId}::uuid AND r.external_id LIKE 'micro-%'`,
      )
      const pages = await Effect.runPromise(
        allPages(scoped("micro"), undefined, 1),
      )
      expect(pages.rows.map((row) => row.anchor.startedAt)).toEqual([
        "2026-10-10T10:00:00.000002Z",
        "2026-10-10T10:00:00.000003Z",
        "2026-10-10T10:00:00.000004Z",
      ])
    }, 30000)

    it("rejects unsupported filters, foreign sessions and populations above the finite read budget", async () => {
      await expect(
        owner().workflow.linkedComparison({
          ...base,
          environment: "production",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        owner().workflow.linkedComparison({
          ...base,
          businessKey: "provider",
          businessValue: "not-configured",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const foreign = appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: {
            cookie: fixture.cookie,
            "x-flowmark-project-id": fixture.foreignProjectId,
          },
        }),
      })
      await expect(
        foreign.workflow.linkedComparison(base),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await owner().resultDeclarations.create({
        projectId: fixture.projectId,
        workflow: "budget.upstream",
        declaration: { revision: "v1", fields: [] },
      })
      await run("budget.upstream", "budget-start").pipe(Effect.runPromise)
      await connection.db.execute(
        sql`INSERT INTO workflow_runs (workflow_id, external_id, started_at) SELECT w.id, 'budget-' || n, '2026-10-10T10:00:00Z'::timestamptz FROM workflows w CROSS JOIN generate_series(1, 10001) n WHERE w.project_id = ${fixture.projectId}::uuid AND w.name = 'budget.upstream'`,
      )
      await expect(
        owner().workflow.linkedComparison({
          ...base,
          upstreamWorkflow: "budget.upstream",
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: expect.stringContaining("read budget"),
      })
    }, 30000)
  },
)
