import { randomUUID } from "node:crypto"
import { Array, Effect, HashMap, Option, Schedule } from "effect"
import { sql } from "drizzle-orm"
import type { FlowmarkDatabase } from "../../src/client.js"
import {
  projects,
  projectApiKeys,
  workspaces,
  workflows,
  workflowRuns,
  workflowSearchFields,
} from "../../src/schema/index.js"
import { hashApiKey } from "../../src/persistence/database.js"
import { journeyNeighborsSql } from "../../src/persistence/workflows/sql/reference-journey.js"
import type { ReferenceJourneyQuery } from "@flowmarkdev/core"

export const journeyNamespaces = [
  { workflow: "patient.match", key: "referralRef" },
  { workflow: "appointment.book", key: "bookingRef" },
  { workflow: "notification.dispatch", key: "referralRef" },
] as const

export const createJourneyFixture = Effect.fn("test.createJourneyFixture")(
  function* (db: FlowmarkDatabase) {
    const workspaceId = randomUUID(),
      projectId = randomUUID(),
      foreignProjectId = randomUUID()
    const readKey = `fm_read_${randomUUID()}`,
      foreignKey = `fm_read_${randomUUID()}`,
      writeKey = `fm_write_${randomUUID()}`
    yield* Effect.promise(() =>
      db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Journey edge cases" }),
    )
    yield* Effect.promise(() =>
      db.insert(projects).values(
        Array.map([projectId, foreignProjectId], (id) => ({
          id,
          workspaceId,
          name: `Journey ${id}`,
        })),
      ),
    )
    yield* Effect.promise(() =>
      db.insert(projectApiKeys).values(
        Array.map(
          [
            { projectId, secret: readKey, permission: "read" as const },
            { projectId, secret: writeKey, permission: "write" as const },
            {
              projectId: foreignProjectId,
              secret: foreignKey,
              permission: "read" as const,
            },
          ],
          ({ secret, ...row }) => ({
            ...row,
            keyHash: hashApiKey(secret),
            name: "Disposable journey fixture",
            keyPrefix: secret.slice(0, 16),
          }),
        ),
      ),
    )
    const rows = Array.flatMap([projectId, foreignProjectId], (scope) =>
      Array.map(journeyNamespaces, (namespace) => ({
        id: randomUUID(),
        projectId: scope,
        name: namespace.workflow,
      })),
    )
    yield* Effect.promise(() => db.insert(workflows).values(rows))
    yield* Effect.promise(() =>
      db.insert(workflowSearchFields).values(
        Array.flatMap([projectId, foreignProjectId], (scope) =>
          Array.map(journeyNamespaces, (namespace) => ({
            projectId: scope,
            workflow: namespace.workflow,
            fields: [{ key: namespace.key, role: "lookup" as const }],
          })),
        ),
      ),
    )
    const workflowIds = HashMap.fromIterable(
      Array.map(
        rows,
        (row) => [`${row.projectId}:${row.name}`, row.id] as const,
      ),
    )
    return {
      projectId,
      foreignProjectId,
      readKey,
      foreignKey,
      writeKey,
      workflowIds,
    }
  },
)
export type JourneyFixture = Effect.Success<
  ReturnType<typeof createJourneyFixture>
>
export interface JourneyFixtureRun {
  readonly workflow: (typeof journeyNamespaces)[number]["workflow"]
  readonly externalId: string
  readonly value: string
  readonly foreign?: boolean
  readonly parentRunId?: string
  readonly retryOf?: { readonly workflow: string; readonly runId: string }
  readonly properties?: Record<string, string>
}
export const insertJourneyFixtureRuns = Effect.fn(
  "test.insertJourneyFixtureRuns",
)(function* (
  db: FlowmarkDatabase,
  fixture: JourneyFixture,
  specs: readonly JourneyFixtureRun[],
) {
  const rows = Array.map(specs, (spec) => ({
    id: randomUUID(),
    externalId: spec.externalId,
    workflowId: Option.getOrThrow(
      HashMap.get(
        fixture.workflowIds,
        `${spec.foreign ? fixture.foreignProjectId : fixture.projectId}:${spec.workflow}`,
      ),
    ),
    parentRunId: spec.parentRunId,
    retryOf: spec.retryOf,
    startedAt: new Date("2026-10-01T10:00:00Z"),
    properties: {
      referralRef: spec.value,
      bookingRef: spec.value,
      ...spec.properties,
    },
  }))
  yield* Effect.promise(() => db.insert(workflowRuns).values(rows))
  return Array.map(rows, (row, index) => ({ ...specs[index]!, id: row.id }))
})

export const explainJourneyFrontier = (
  db: FlowmarkDatabase,
  fixture: JourneyFixture,
  query: ReferenceJourneyQuery,
  rootId: string,
) =>
  db.execute<{
    "QUERY PLAN": readonly {
      Plan: {
        "Node Type": string
        "Actual Rows": number
        "Actual Loops": number
      }
      "Execution Time": number
    }[]
  }>(
    sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${journeyNeighborsSql(fixture.projectId, query, [rootId], [rootId], 100)}`,
  )

/** Wait for the real storage clock, never replace application/host time. */
export const waitForJourneyDeadline = (
  db: FlowmarkDatabase,
  deadline: string,
) =>
  Effect.promise(() =>
    db.execute<{ passed: boolean }>(
      sql`SELECT clock_timestamp() > ${deadline}::timestamptz AS passed`,
    ),
  ).pipe(
    Effect.map(([row]) => row!.passed),
    Effect.repeat({
      until: (passed) => passed,
      schedule: Schedule.spaced("5 millis"),
    }),
    Effect.timeout("5 seconds"),
  )
