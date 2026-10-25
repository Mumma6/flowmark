import { createHash } from "node:crypto"
import { Context, Data, Effect, Layer } from "effect"
import type { FlowmarkDatabase } from "../client.js"
import { DatabaseOperation } from "./database-operation.js"

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: DatabaseOperation
  readonly cause: unknown
}> {}

export class MissingRunError extends Data.TaggedError("MissingRunError")<{
  readonly runId: string
}> {}

export const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex")

export const apiKeyPrefix = (key: string) => key.slice(0, 16)
export const Database = Context.GenericTag<FlowmarkDatabase>(
  "@flowmark/db/Database",
)
export const provideDatabase =
  (db: FlowmarkDatabase) =>
  <A, E>(
    operation: Effect.Effect<A, E, FlowmarkDatabase>,
  ): Effect.Effect<A, E> =>
    operation.pipe(Effect.provideService(Database, db))
export const databaseLayer = (db: FlowmarkDatabase) =>
  Layer.succeed(Database, db)
