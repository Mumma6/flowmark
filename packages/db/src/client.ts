import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"
import { preparedClient } from "./prepared-client.js"
import { cancellableClient } from "./cancellable-client.js"

export type FlowmarkDatabase = PostgresJsDatabase<typeof schema>

export function createDatabase(
  connectionString: string,
  options: {
    readonly prepare?: boolean
    readonly signal?: AbortSignal
    readonly statementTimeoutMs?: number
  } = {},
): {
  db: FlowmarkDatabase
  close: () => Promise<void>
  cancel: () => void
} {
  const client = postgres(connectionString, {
    prepare: options.prepare ?? false,
    ...(options.statementTimeoutMs
      ? { connection: { statement_timeout: options.statementTimeoutMs } }
      : {}),
  })
  const prepared = options.prepare ? preparedClient(client) : client
  const cancellation = new AbortController()
  const signal = options.signal
    ? AbortSignal.any([options.signal, cancellation.signal])
    : cancellation.signal
  const scoped = cancellableClient(prepared, signal)
  return {
    db: drizzle(scoped, { schema }),
    close: () => client.end(),
    cancel: () => cancellation.abort(),
  }
}
