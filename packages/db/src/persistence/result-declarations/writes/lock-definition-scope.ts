import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { FlowmarkDatabase } from "../../../client.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export type DefinitionTransaction = Parameters<
  Parameters<FlowmarkDatabase["transaction"]>[0]
>[0]

/** All declaration writers serialize here, including when no configuration row exists. */
export const lockDefinitionScope = Effect.fn("lockDefinitionScope")(function* (
  tx: DefinitionTransaction,
  projectId: string,
  workflow: string,
) {
  yield* runQuery(DatabaseOperation.ApplyDefinitionImport, () =>
    tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${JSON.stringify(["definition", projectId, workflow])}, 0))`,
    ),
  )
})
