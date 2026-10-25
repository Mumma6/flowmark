import { createHash } from "node:crypto"
import { Context, Data, Layer } from "effect"
import type { FlowmarkDatabase } from "../index.js"

export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly operation: string
  readonly cause: unknown
}> {}

export class MissingRunError extends Data.TaggedError("MissingRunError")<{
  readonly runId: string
}> {}

export const hashApiKey = (key: string) =>
  createHash("sha256").update(key).digest("hex")
export const Database = Context.GenericTag<FlowmarkDatabase>(
  "@flowmark/db/Database",
)
export const databaseLayer = (db: FlowmarkDatabase) =>
  Layer.succeed(Database, db)
