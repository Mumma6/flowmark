import { migrate } from "drizzle-orm/postgres-js/migrator"
import { Effect } from "effect"
import { DatabaseError } from "../persistence/database.js"
import { DatabaseOperation } from "../persistence/database-operation.js"
import { withCommandDatabase } from "./connection.js"

export const applyCommittedMigrations = Effect.fn("applyCommittedMigrations")(
  function* (url: string) {
    yield* withCommandDatabase(url, (db) =>
      Effect.tryPromise({
        try: () =>
          migrate(db, {
            migrationsFolder: new URL("../../migrations", import.meta.url)
              .pathname,
          }),
        catch: (cause) =>
          new DatabaseError({ operation: DatabaseOperation.Migrate, cause }),
      }),
    )
  },
)
