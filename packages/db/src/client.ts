import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"
import { preparedClient } from "./prepared-client.js"

export type FlowmarkDatabase = PostgresJsDatabase<typeof schema>

export function createDatabase(
  connectionString: string,
  options: { readonly prepare?: boolean } = {},
): {
  db: FlowmarkDatabase
  close: () => Promise<void>
} {
  const client = postgres(connectionString, {
    prepare: options.prepare ?? false,
  })
  return {
    db: drizzle(options.prepare ? preparedClient(client) : client, { schema }),
    close: () => client.end(),
  }
}
