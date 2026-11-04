export { withCommandDatabase } from "./connection.js"
export { readLocalDevelopmentDatabaseUrl } from "../environment/local-database.js"
export { loadApiEnvironment } from "../environment/load.js"
export { assertTestDatabaseTarget } from "../environment/test-database.js"

import { Effect } from "effect"
import { sql } from "drizzle-orm"
import type { FlowmarkDatabase } from "../client.js"
import { DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { runQuery } from "../persistence/run-query.js"

export const assertFixtureConnection = Effect.fn("assertFixtureConnection")(
  function* (db: FlowmarkDatabase, url: string) {
    const target = new URL(url)
    const [identity] = yield* runQuery(DatabaseOperation.InspectDataset, () =>
      db.execute<{ database: string; role: string }>(
        sql`select current_database() as database, current_user as role`,
      ),
    )
    if (
      identity?.database !== decodeURIComponent(target.pathname.slice(1)) ||
      identity?.role !== decodeURIComponent(target.username)
    ) {
      return yield* new DatabaseError({
        operation: DatabaseOperation.InspectDataset,
        cause: "Fixture database identity does not match the verified target.",
      })
    }
  },
)
