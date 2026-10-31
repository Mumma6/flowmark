import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  workspaces,
  projects,
  projectApiKeys,
  workflowResultDeclarations,
  workflowSearchFields,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import { POST } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

const fields = [
  {
    path: ["saved"],
    label: "Saved",
    kind: "count" as const,
    aggregate: true,
    unit: "rows",
  },
  {
    path: ["input"],
    label: "Input",
    kind: "count" as const,
    aggregate: true,
    unit: "rows",
  },
  {
    path: ["category"],
    label: "Category",
    kind: "category" as const,
    aggregate: true,
    values: ["partial", "complete"],
  },
  {
    path: ["reasons"],
    label: "Reasons",
    kind: "reasons" as const,
    aggregate: true,
    values: ["invalid", "duplicate"],
  },
]
const query = {
  workflow: "analytics.import",
  revision: "v1",
  path: ["saved"],
  currentStartedAfter: "2026-10-20T00:00:00.000Z",
  currentStartedBefore: "2026-10-27T00:00:00.000Z",
  previousStartedAfter: "2026-10-13T00:00:00.000Z",
  previousStartedBefore: "2026-10-20T00:00:00.000Z",
  numerator: ["saved"],
  denominator: ["input"],
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "business outcome cohorts through HTTP/PostgreSQL",
  () => {
    const projectId = randomUUID(),
      workspaceId = randomUUID(),
      otherProjectId = randomUUID()
    const writeKey = randomUUID(),
      readKey = randomUUID(),
      otherReadKey = randomUUID()
    let connection: ReturnType<typeof createDatabase>
    const caller = (key = readKey) =>
      appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: `Bearer ${key}` },
        }),
      })
    const send = (event: unknown, eventId = randomUUID()) =>
      POST(
        new Request("http://localhost/v1/events", {
          method: "POST",
          headers: { authorization: `Bearer ${writeKey}` },
          body: JSON.stringify({ eventId, event }),
        }),
      )
    const run = async (options: {
      result?: Record<string, unknown>
      started?: string
      revision?: string
      release?: string
      failed?: boolean
      open?: boolean
      workflow?: string
      report?: boolean
      outcome?: string
    }) => {
      const runId = randomUUID(),
        workflow = options.workflow ?? query.workflow,
        timestamp = options.started ?? "2026-10-21T00:00:00.000Z"
      expect(
        (
          await send({
            type: "started",
            workflow,
            runId,
            timestamp,
            release: options.release ?? "b",
            properties: {
              definitionRevision: options.revision ?? "v1",
              provider: "crm-a",
            },
          })
        ).status,
      ).toBe(202)
      if (options.report) {
        expect(
          (
            await send({
              type: "report",
              workflow,
              runId,
              timestamp,
              result: { saved: 999999, input: 999999 },
            })
          ).status,
        ).toBe(202)
      }
      if (!options.open) {
        const event = {
          type: options.failed ? "failed" : "completed",
          workflow,
          runId,
          timestamp: "2026-10-30T00:00:00.000Z",
          ...(options.failed ? { failure: { code: "PARTIAL_IMPORT" } } : {}),
          ...(options.result === undefined ? {} : { result: options.result }),
          ...(options.outcome ? { outcome: options.outcome } : {}),
        }
        const eventId = randomUUID()
        expect((await send(event, eventId)).status).toBe(202)
        expect((await send(event, eventId)).status).toBe(202)
      }
      return runId
    }
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      await connection.db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Business insight test" })
      await connection.db.insert(projects).values([
        { id: projectId, workspaceId, name: "Insights" },
        { id: otherProjectId, workspaceId, name: "Other" },
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
      await connection.db.insert(workflowResultDeclarations).values(
        [
          query.workflow,
          "analytics.release",
          "analytics.reasons",
          "analytics.precision",
        ].map((workflow) => ({
          projectId,
          workflow,
          revision: "v1",
          declaration: { revision: "v1", fields },
        })),
      )
      await connection.db.insert(workflowSearchFields).values({
        projectId,
        workflow: query.workflow,
        fields: [
          { key: "provider", role: "dimension", values: ["crm-a", "crm-b"] },
        ],
      })
      await run({
        release: "a",
        result: {
          saved: 1,
          input: 2,
          category: "partial",
          reasons: { invalid: 1 },
        },
        outcome: "partial",
      })
      await run({
        release: "a",
        failed: true,
        result: {
          saved: 9,
          input: 100,
          category: "partial",
          reasons: { invalid: 91 },
        },
        outcome: "partial",
      })
      await run({
        release: "a",
        result: { saved: 0, input: 0, category: "complete", reasons: {} },
        outcome: "complete",
      })
      await run({
        result: {
          saved: 5,
          input: 10,
          category: "mystery",
          reasons: { invalid: "bad" },
        },
        outcome: "partial",
      })
      await run({})
      await run({ result: { input: 3 } })
      await run({ result: { saved: "seven", input: 5, category: 7 } })
      await run({ revision: "v2", result: { saved: 999, input: 999 } })
      await run({ open: true, report: true })
      await run({ report: true, result: { saved: 2, input: 4 } })
      await run({
        started: query.previousStartedAfter,
        result: { saved: 100, input: 100 },
      })
      await run({
        started: query.currentStartedBefore,
        result: { saved: 555, input: 555 },
      })
      for (let index = 0; index < 120; index++) {
        await run({
          release: "bulk",
          result: { saved: 1, input: 1, category: "complete", reasons: {} },
          outcome: "complete",
        })
      }
    }, 60_000)
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("counts attempts once, excludes intermediate reports, preserves coverage and weights ratio totals", async () => {
      const data = await caller().project.businessInsights(query)
      const current = data.windows.find((window) => window.scope === "current")!
      expect(current).toMatchObject({
        totalRuns: 130,
        finishedRuns: 129,
        failedRuns: 1,
        openRuns: 1,
        incompatibleRevision: 1,
        missingResult: 1,
        missingField: 1,
        wrongType: 1,
        knownRuns: 125,
        total: "137",
        ratio: { knownRuns: 125, numerator: "137", denominator: "236" },
      })
      expect(current.ratio.value).toBeCloseTo(137 / 236)
      expect(current.outcomes).toEqual([
        { value: "complete", runs: 121 },
        { value: "partial", runs: 3 },
      ])
      expect(current.missingOutcome).toBe(5)
      expect(
        (
          await caller().run.list({
            workflow: query.workflow,
            startedAfter: query.currentStartedAfter,
            startedBeforeExclusive: query.currentStartedBefore,
            ratioSelection: {
              revision: "v1",
              numerator: ["saved"],
              denominator: ["input"],
            },
          })
        ).total,
      ).toBe(current.ratio.knownRuns)
      const released = await caller().project.businessInsights({
        ...query,
        releaseA: "a",
        releaseB: "b",
      })
      const a = released.windows.find((window) => window.scope === "releaseA")!
      expect(a.ratio.value).toBeCloseTo(10 / 102)
      expect(a.ratio.value).not.toBeCloseTo((1 / 2 + 9 / 100) / 2)
      expect(released.releaseComparison).toMatchObject({ available: false })
      expect(
        released.windows.find((window) => window.scope === "previous"),
      ).toMatchObject({ totalRuns: 1, total: "100" })
    })

    it("filters category/numeric/reason evidence beyond 100 runs with stable count and half-open boundaries", async () => {
      const filter = {
        workflow: query.workflow,
        startedAfter: query.currentStartedAfter,
        startedBeforeExclusive: query.currentStartedBefore,
        terminalOnly: true,
        definitionRevision: "v1",
        resultSelection: {
          revision: "v1",
          path: ["category"],
          operator: "eq" as const,
          value: "complete",
        },
        limit: 25,
      }
      const ids = new Set<string>()
      let cursor: string | undefined
      do {
        const page = await caller().run.list({ ...filter, cursor })
        expect(page.total).toBe(121)
        for (const row of page.runs) {
          expect(ids.has(row.id)).toBe(false)
          ids.add(row.id)
        }
        cursor = page.nextCursor ?? undefined
      } while (cursor)
      expect(ids.size).toBe(121)
      expect(
        (
          await caller().run.list({
            ...filter,
            resultSelection: {
              revision: "v1",
              path: ["saved"],
              operator: "gte",
              value: 5,
            },
          })
        ).total,
      ).toBe(2)
      expect(
        (
          await caller().run.list({
            ...filter,
            resultSelection: {
              revision: "v1",
              path: ["reasons"],
              reason: "invalid",
              operator: "gte",
              value: 0,
            },
          })
        ).total,
      ).toBe(2)
      const numeric = {
        ...filter,
        resultSelection: {
          revision: "v1",
          path: ["saved"],
          operator: "gte" as const,
          value: 1,
        },
        limit: 100,
      }
      const numericFirst = await caller().run.list(numeric)
      const numericSecond = await caller().run.list({
        ...numeric,
        cursor: numericFirst.nextCursor!,
      })
      expect(numericFirst.total).toBe(124)
      expect(numericFirst.runs).toHaveLength(100)
      expect(numericSecond.runs).toHaveLength(24)
      expect(
        new Set(
          [...numericFirst.runs, ...numericSecond.runs].map((row) => row.id),
        ).size,
      ).toBe(124)
      expect(
        (
          await caller().run.list({
            ...filter,
            resultSelection: {
              revision: "v1",
              path: ["saved"],
              operator: "lte",
              value: 0,
            },
          })
        ).total,
      ).toBe(1)
      const categories = await caller().project.businessInsights({
        ...query,
        path: ["category"],
      })
      expect(
        categories.windows.find((window) => window.scope === "current"),
      ).toMatchObject({ unknownCategory: 1, wrongType: 1 })
      const reasons = await caller().project.businessInsights({
        ...query,
        path: ["reasons"],
      })
      expect(
        reasons.windows.find((window) => window.scope === "current")
          ?.categories,
      ).toEqual([
        { value: "duplicate", runs: 0, total: null },
        { value: "invalid", runs: 2, total: "92" },
      ])
    })

    it("keeps reason evidence identical when another reason is invalid or unconfigured", async () => {
      await run({
        workflow: "analytics.reasons",
        result: { reasons: { invalid: 1, duplicate: "bad" } },
      })
      await run({
        workflow: "analytics.reasons",
        result: { reasons: { invalid: 2, unknown: 1 } },
      })
      await run({
        workflow: "analytics.reasons",
        result: { reasons: { invalid: 0 } },
      })
      const data = await caller().project.businessInsights({
        ...query,
        workflow: "analytics.reasons",
        path: ["reasons"],
      })
      expect(
        data.windows.find((window) => window.scope === "current"),
      ).toMatchObject({
        knownRuns: 1,
        wrongType: 1,
        unknownCategory: 1,
        categories: [
          { value: "duplicate", runs: 0, total: null },
          { value: "invalid", runs: 1, total: "0" },
        ],
      })
      const evidence = await caller().run.list({
        workflow: "analytics.reasons",
        resultSelection: {
          revision: "v1",
          path: ["reasons"],
          reason: "invalid",
          operator: "gte",
          value: 0,
        },
      })
      expect(evidence.total).toBe(1)
    })

    it("rejects foreign projects, undeclared result SQL and unconfigured dimensions", async () => {
      await expect(
        caller(otherReadKey).project.businessInsights(query),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        caller().project.businessInsights({
          ...query,
          path: ["secret' OR true --"],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        caller().project.businessInsights({
          ...query,
          businessKey: "provider",
          businessValue: "not-configured",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        caller().run.list({
          workflow: query.workflow,
          resultSelection: {
            revision: "v1",
            path: ["arbitrary"],
            operator: "gte",
            value: 0,
          },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        caller().run.list({
          workflow: query.workflow,
          resultSelection: {
            revision: "v1",
            path: ["category"],
            operator: "gte",
            value: 3,
          },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      expect(
        (
          await caller().project.businessInsights({
            ...query,
            businessKey: "provider",
            businessValue: "crm-b",
          })
        ).windows.every(
          (window) =>
            window.totalRuns === 0 &&
            window.total === null &&
            window.ratio.value === null,
        ),
      ).toBe(true)
    })

    it("updates the original start cohort after late terminal evidence without accepting amended revisions", async () => {
      const runId = await run({
        started: "2026-10-15T00:00:00.000Z",
        open: true,
        report: true,
      })
      const before = await caller().project.businessInsights(query)
      expect(
        before.windows.find((window) => window.scope === "previous"),
      ).toMatchObject({ totalRuns: 2, knownRuns: 1, openRuns: 1, total: "100" })
      expect(
        (
          await send({
            type: "properties",
            workflow: query.workflow,
            runId,
            timestamp: "2026-10-29T00:00:00.000Z",
            properties: { definitionRevision: "v2" },
          })
        ).status,
      ).toBe(202)
      expect(
        (
          await send({
            type: "completed",
            workflow: query.workflow,
            runId,
            timestamp: "2026-10-30T00:00:00.000Z",
            result: { saved: 2, input: 4 },
          })
        ).status,
      ).toBe(202)
      const after = await caller().project.businessInsights(query)
      expect(
        after.windows.find((window) => window.scope === "previous"),
      ).toMatchObject({ totalRuns: 2, knownRuns: 2, openRuns: 0, total: "102" })
      expect(
        (
          await caller().run.list({
            workflow: query.workflow,
            externalId: runId,
            definitionRevision: "v1",
          })
        ).total,
      ).toBe(1)
      expect(
        (
          await caller().run.list({
            workflow: query.workflow,
            externalId: runId,
            definitionRevision: "v2",
          })
        ).total,
      ).toBe(0)
    })

    it("keeps count sums exact beyond the JavaScript safe integer range", async () => {
      await run({
        workflow: "analytics.precision",
        result: {
          saved: Number.MAX_SAFE_INTEGER,
          input: Number.MAX_SAFE_INTEGER,
        },
      })
      await run({
        workflow: "analytics.precision",
        result: {
          saved: Number.MAX_SAFE_INTEGER,
          input: Number.MAX_SAFE_INTEGER,
        },
      })
      const data = await caller().project.businessInsights({
        ...query,
        workflow: "analytics.precision",
      })
      expect(
        data.windows.find((window) => window.scope === "current"),
      ).toMatchObject({
        total: "18014398509481982",
        ratio: {
          numerator: "18014398509481982",
          denominator: "18014398509481982",
          value: 1,
        },
      })
    })

    it("compares only sufficiently observed compatible releases and preserves explicit zero denominators", async () => {
      for (const release of ["one", "two"]) {
        for (let index = 0; index < 5; index++) {
          await run({
            workflow: "analytics.release",
            release,
            result: { saved: 0, input: 0 },
          })
        }
      }
      const data = await caller().project.businessInsights({
        ...query,
        workflow: "analytics.release",
        releaseA: "one",
        releaseB: "two",
      })
      expect(data.releaseComparison.available).toBe(true)
      expect(
        data.windows.find((window) => window.scope === "releaseA"),
      ).toMatchObject({
        knownRuns: 5,
        total: "0",
        ratio: { numerator: "0", denominator: "0", value: null },
      })
      for (let index = 0; index < 5; index++) {
        await run({
          workflow: "analytics.release",
          release: "sparse",
          result: { saved: 0 },
        })
      }
      const sparse = await caller().project.businessInsights({
        ...query,
        workflow: "analytics.release",
        releaseA: "one",
        releaseB: "sparse",
      })
      expect(sparse.releaseComparison.available).toBe(false)
      expect(
        sparse.windows.find((window) => window.scope === "releaseB"),
      ).toMatchObject({ knownRuns: 5, ratio: { knownRuns: 0, value: null } })
      const insufficient = await caller().project.businessInsights({
        ...query,
        workflow: "analytics.release",
        releaseA: "one",
        releaseB: "absent",
      })
      expect(insufficient.releaseComparison).toMatchObject({
        available: false,
        reason: "Each release needs at least five known result observations.",
      })
    }, 20_000)
  },
)
