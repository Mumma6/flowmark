import process from "node:process"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { CommandConfigurationError } from "../environment/error.js"
import { loadApiEnvironment } from "../environment/load.js"
import {
  assertLocalDevelopmentDatabase,
  readDatabaseUrl,
} from "../environment/runtime.js"
import { DEMO_PROJECT_ID } from "../fixtures/demo.js"
import { DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { withCommandDatabase } from "./connection.js"
import { runDatabaseCommand } from "./run.js"

const resetLocalTelemetry = Effect.fn("resetLocalTelemetry")(function* (
  url: string,
) {
  const counts = yield* withCommandDatabase(url, (db) =>
    Effect.tryPromise({
      try: () =>
        db.transaction(async (tx) => {
          const events = await tx.execute(sql`
            DELETE FROM workflow_events WHERE run_id IN (
              SELECT r.id FROM workflow_runs r JOIN workflows w ON w.id=r.workflow_id
              WHERE w.project_id=${DEMO_PROJECT_ID}
            ) RETURNING id`)
          const runs = await tx.execute(sql`
            DELETE FROM workflow_runs WHERE workflow_id IN (
              SELECT id FROM workflows WHERE project_id=${DEMO_PROJECT_ID}
            ) RETURNING id`)
          const workflows = await tx.execute(sql`
            DELETE FROM workflows WHERE project_id=${DEMO_PROJECT_ID} RETURNING id`)
          return {
            events: events.length,
            runs: runs.length,
            workflows: workflows.length,
          }
        }),
      catch: (cause) =>
        new DatabaseError({ operation: DatabaseOperation.Reset, cause }),
    }),
  )
  yield* Effect.sync(() => {
    console.log(
      `Deleted local telemetry: ${counts.events} events, ${counts.runs} runs, ${counts.workflows} workflows. Other projects, accounts and keys were not changed.`,
    )
  })
})

await runDatabaseCommand(
  Effect.gen(function* () {
    yield* loadApiEnvironment
    const url = yield* readDatabaseUrl()
    yield* assertLocalDevelopmentDatabase(url)
    if (!process.argv.includes("--confirm-local-telemetry")) {
      return yield* new CommandConfigurationError({
        reason:
          "Pass --confirm-local-telemetry to delete only the local development project's telemetry. Accounts and credentials are retained.",
      })
    }
    yield* resetLocalTelemetry(url)
  }),
)
