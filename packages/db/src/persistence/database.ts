import { createHash } from "node:crypto"
import { Context, Data, Effect, Layer } from "effect"
import type { FlowmarkDatabase } from "../client.js"
import { DatabaseOperation } from "./database-operation.js"

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: DatabaseOperation
  readonly cause: unknown
}> {}

export class InvalidResultQuery extends Data.TaggedError("InvalidResultQuery")<{
  readonly message: string
}> {}

export class MissingRunError extends Data.TaggedError("MissingRunError")<{
  readonly runId: string
}> {}

export class IngestionRejected extends Data.TaggedError("IngestionRejected")<{
  readonly reason:
    "ProjectUnavailable" | "CredentialRevoked" | "HistoricalStart"
}> {}

export const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex")

export const apiKeyPrefix = (key: string) => key.slice(0, 16)
export const Database = Context.Service<FlowmarkDatabase>(
  "@flowmark/db/Database",
)

/** Connection-owned cancellation, captured by stores alongside their database. */
export const DatabaseCancellation = Context.Reference<() => void>(
  "@flowmark/db/DatabaseCancellation",
  { defaultValue: () => () => undefined },
)

/** Optional request-owned SQL deadline; ordinary API traffic retains its policy. */
export const DatabaseReadBudget = Context.Reference<{
  readonly statementTimeoutMs?: number
  readonly maxOperationFacts?: number
}>("@flowmark/db/ReadBudget", { defaultValue: () => ({}) })
export const provideDatabase =
  (db: FlowmarkDatabase, cancel: () => void = () => undefined) =>
  <A, E>(
    operation: Effect.Effect<A, E, FlowmarkDatabase>,
  ): Effect.Effect<A, E> =>
    operation.pipe(
      Effect.provideService(Database, db),
      Effect.provideService(DatabaseCancellation, cancel),
    )
export const databaseLayer = (db: FlowmarkDatabase) =>
  Layer.succeed(Database, db)
