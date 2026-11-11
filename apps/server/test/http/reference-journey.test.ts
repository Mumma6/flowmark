import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Array, Effect } from "effect"
import {
  createDatabase,
  workspaces,
  projects,
  workflows,
  workflowRuns,
  workflowEvents,
  workflowSearchFields,
  projectApiKeys,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import type { ReferenceJourneyQuery, ReferenceJourneyPage } from "@flowmark/api"
import { GET } from "../../app/api/trpc/[trpc]/route"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "qualified reference journeys through real SQL and HTTP",
  () => {
    let connection: ReturnType<typeof createDatabase>
    const workspaceId = randomUUID(),
      projectId = randomUUID(),
      otherProjectId = randomUUID()
    const key = `fm_read_${randomUUID()}`,
      otherKey = `fm_read_${randomUUID()}`
    const workflowIds = new Map<string, string>()
    const names = [
      "referral.ingest",
      "patient.match",
      "appointment.book",
      "notification.dispatch",
      "unmapped.sync",
    ]
    const namespaces = Array.map(names.slice(1, 4), (workflow) => ({
      workflow,
      key: "referralRef",
    }))
    const input = (
      value: string,
      extra: Partial<ReferenceJourneyQuery> = {},
    ): ReferenceJourneyQuery => ({
      workflow: "patient.match",
      key: "referralRef",
      value,
      namespaces,
      ...extra,
    })
    const request = (query: unknown, token = key) =>
      GET(
        new Request(
          `http://localhost:3001/api/trpc/workflow.journey?input=${encodeURIComponent(JSON.stringify(query))}`,
          { headers: token ? { authorization: `Bearer ${token}` } : {} },
        ),
      )
    const read = async (query: ReferenceJourneyQuery) => {
      const response = await request(query)
      expect(response.status).toBe(200)
      return (
        (await response.json()) as { result: { data: ReferenceJourneyPage } }
      ).result.data
    }
    const insertRun = async (
      workflow: string,
      externalId: string,
      value: string,
      extras: {
        parentRunId?: string
        retryOf?: { workflow: string; runId: string }
        foreign?: boolean
        outcome?: string
      } = {},
    ) => {
      const id = randomUUID()
      await connection.db.insert(workflowRuns).values({
        id,
        workflowId: workflowIds.get(
          `${extras.foreign ? "foreign:" : ""}${workflow}`,
        )!,
        externalId,
        startedAt: new Date("2026-11-01T10:00:00Z"),
        properties: { referralRef: value, otherRef: value },
        parentRunId: extras.parentRunId,
        retryOf: extras.retryOf,
        outcome: extras.outcome,
      })
      return id
    }
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      await connection.db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Reference journey tests" })
      await connection.db.insert(projects).values([
        { id: projectId, workspaceId, name: "Scoped journeys" },
        { id: otherProjectId, workspaceId, name: "Foreign journeys" },
      ])
      await connection.db.insert(projectApiKeys).values([
        {
          projectId,
          keyHash: hashApiKey(key),
          permission: "read",
          keyPrefix: key.slice(0, 16),
          name: "Journey test",
        },
        {
          projectId: otherProjectId,
          keyHash: hashApiKey(otherKey),
          permission: "read",
          keyPrefix: otherKey.slice(0, 16),
          name: "Foreign test",
        },
      ])
      await Effect.runPromise(
        Effect.forEach([projectId, otherProjectId], (scope) =>
          Effect.forEach(names, (name) =>
            Effect.promise(async () => {
              const id = randomUUID()
              workflowIds.set(
                `${scope === otherProjectId ? "foreign:" : ""}${name}`,
                id,
              )
              await connection.db
                .insert(workflows)
                .values({ id, projectId: scope, name })
              await connection.db.insert(workflowSearchFields).values({
                projectId: scope,
                workflow: name,
                fields: [{ key: "referralRef", role: "lookup" }],
              })
            }),
          ),
        ),
      )
    })
    afterAll(async () => {
      // The managed runner owns and removes this disposable database, including fixtures.
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("follows referral, booking, notification and retries without entering batch siblings or unmapped namespaces", async () => {
      const batch = await insertRun(
        "referral.ingest",
        "batch-1",
        "batch-reference",
      )
      const match = await insertRun("patient.match", "match-1", "REF-1", {
        parentRunId: "batch-1",
      })
      const book = await insertRun("appointment.book", "book-1", "REF-1", {
        parentRunId: "match-1",
        outcome: "pending_confirmation",
      })
      const retry = await insertRun(
        "appointment.book",
        "book-retry-1",
        "REF-1",
        {
          parentRunId: "match-1",
          retryOf: { workflow: "appointment.book", runId: "book-1" },
        },
      )
      const notify = await insertRun(
        "notification.dispatch",
        "notify-1",
        "REF-1",
        { parentRunId: "book-retry-1" },
      )
      const sibling = await insertRun(
        "patient.match",
        "sibling-1",
        "DIFFERENT",
        { parentRunId: "batch-1" },
      )
      const unrelated = await insertRun(
        "unmapped.sync",
        "unmapped-1",
        "REF-1",
        { parentRunId: "match-1" },
      )
      const unlinked = await insertRun(
        "notification.dispatch",
        "unlinked-1",
        "REF-1",
      )
      const foreign = await insertRun(
        "appointment.book",
        "foreign-1",
        "REF-1",
        { parentRunId: "match-1", foreign: true },
      )
      await connection.db.insert(workflowEvents).values([
        {
          eventId: randomUUID(),
          runId: book,
          type: "completed",
          occurredAt: new Date(),
          result: { pending: 1 },
        },
        {
          eventId: randomUUID(),
          runId: retry,
          type: "failed",
          occurredAt: new Date(),
        },
      ])
      const page = await read(input("REF-1"))
      expect(page.state).toBe("Selected")
      expect(new Set(page.nodes.map((node) => node.id))).toEqual(
        new Set([match, book, retry, notify]),
      )
      expect(
        page.nodes.find((node) => node.id === match)?.parent.matches[0]?.id,
      ).toBe(batch)
      expect(page.edges).toContainEqual({
        fromRunId: batch,
        toRunId: match,
        kind: "parent",
        scope: "context",
      })
      expect(page.nodes.find((node) => node.id === book)).toMatchObject({
        status: "Completed",
        outcome: "pending_confirmation",
      })
      expect(page.nodes.find((node) => node.id === retry)?.status).toBe(
        "Failed",
      )
      expect(page.edges).toContainEqual({
        fromRunId: book,
        toRunId: retry,
        kind: "retry",
        scope: "journey",
      })
      expect(
        page.nodes.some((node) =>
          Array.some(
            [sibling, unrelated, foreign, unlinked, batch],
            (id) => id === node.id,
          ),
        ),
      ).toBe(false)
      expect(
        (await request(input("REF-1", { anchorRunId: foreign }))).status,
      ).toBe(400)
      expect((await request(input("REF-1"), otherKey)).status).toBe(200)
      expect(
        (
          await read(
            input("REF-1", {
              key: "otherRef",
              namespaces: [{ workflow: "patient.match", key: "otherRef" }],
            }),
          )
        ).state,
      ).toBe("NotFound")
      expect((await request(input("REF-1"), "")).status).toBe(401)
      expect(
        (await request({ ...input("REF-1"), environment: "prod" })).status,
      ).toBe(400)
    })

    it("requires explicit anchor choice and binds candidate and node cursors to the entire selection", async () => {
      const first = await insertRun("patient.match", "duplicate-a", "DUP")
      const second = await insertRun("patient.match", "duplicate-b", "DUP")
      const choices = await read(input("DUP", { limit: 1 }))
      expect(choices.state).toBe("Ambiguous")
      expect(choices.nodes).toEqual([])
      expect(choices.nextCandidateCursor).toBeTruthy()
      const rest = await read(
        input("DUP", {
          limit: 1,
          candidateCursor: choices.nextCandidateCursor!,
        }),
      )
      expect(rest.state).toBe("Ambiguous")
      expect(
        new Set(
          [...choices.candidates, ...rest.candidates].map((node) => node.id),
        ),
      ).toEqual(new Set([first, second]))
      expect(
        (await read(input("DUP", { anchorRunId: first }))).nodes.map(
          (node) => node.id,
        ),
      ).toEqual([first])
      expect(
        (
          await request(
            input("DIFFERENT", {
              candidateCursor: choices.nextCandidateCursor!,
            }),
          )
        ).status,
      ).toBe(400)
      const selected = await read(input("REF-1", { limit: 1 }))
      expect(selected.nextCursor).toBeTruthy()
      const next = await read(
        input("REF-1", { limit: 1, cursor: selected.nextCursor! }),
      )
      expect(next.nodes[0]?.id).not.toBe(selected.nodes[0]?.id)
      expect(
        (
          await request(
            input("DUP", { anchorRunId: first, cursor: selected.nextCursor! }),
          )
        ).status,
      ).toBe(400)
      const changedMap = [
        ...namespaces,
        { workflow: "unmapped.sync", key: "referralRef" },
      ]
      expect(
        (
          await request(
            input("REF-1", {
              namespaces: changedMap,
              cursor: selected.nextCursor!,
            }),
          )
        ).status,
      ).toBe(400)
    })

    it("keeps missing and ambiguous parents explicit without treating an equal external ID as a qualified identity", async () => {
      const root = await insertRun(
        "patient.match",
        "ambiguous-parent",
        "AMBIG",
        { parentRunId: "missing-batch" },
      )
      await insertRun("unmapped.sync", "ambiguous-parent", "OTHER")
      const child = await insertRun(
        "appointment.book",
        "ambiguous-child",
        "AMBIG",
        { parentRunId: "ambiguous-parent" },
      )
      const anchor = await read(input("AMBIG"))
      expect(anchor.nodes.map((node) => node.id)).toEqual([root])
      expect(anchor.nodes[0]?.parent.state).toBe("missing")
      const childPage = await read(
        input("AMBIG", { workflow: "appointment.book", anchorRunId: child }),
      )
      expect(childPage.nodes.map((node) => node.id)).toEqual([child])
      expect(childPage.nodes[0]?.parent.state).toBe("ambiguous")
      expect(childPage.nodes[0]?.parent.matches).toHaveLength(2)
      expect(childPage.edges).toEqual([])
    })

    it("terminates cycles and enforces graph/page bounds before returning large branches", async () => {
      const a = await insertRun("patient.match", "cycle-a", "CYCLE", {
        parentRunId: "cycle-b",
      })
      const b = await insertRun("appointment.book", "cycle-b", "CYCLE", {
        parentRunId: "cycle-a",
      })
      const cyclic = await read(input("CYCLE"))
      expect(new Set(cyclic.nodes.map((node) => node.id))).toEqual(
        new Set([a, b]),
      )
      expect(cyclic.bounds.cycleDetected).toBe(true)
      const wide = await insertRun("patient.match", "wide-root", "WIDE")
      await connection.db.insert(workflowRuns).values(
        Array.map(Array.range(1, 120), (index) => ({
          id: randomUUID(),
          workflowId: workflowIds.get("appointment.book")!,
          externalId: `wide-${index}`,
          parentRunId: "wide-root",
          properties: { referralRef: "WIDE" },
          startedAt: new Date("2026-11-02T10:00:00Z"),
        })),
      )
      const walk = async (
        cursor?: string,
        ids: readonly string[] = [],
      ): Promise<readonly string[]> => {
        const page = await read(input("WIDE", { limit: 50, cursor }))
        expect(page.bounds.traversalTruncated).toBe(true)
        expect(page.nodes.length).toBeLessThanOrEqual(50)
        expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(64 * 1024)
        const next = [...ids, ...page.nodes.map((node) => node.id)]
        return page.nextCursor ? walk(page.nextCursor, next) : next
      }
      const ids = await walk()
      expect(ids).toHaveLength(100)
      expect(new Set(ids).size).toBe(100)
      expect(ids).toContain(wide)
    })
  },
)
