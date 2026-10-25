import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema/index.js"

export type FlowmarkDatabase = PostgresJsDatabase<typeof schema>

export function createDatabase(connectionString: string): {
  db: FlowmarkDatabase
  close: () => Promise<void>
} {
  const client = postgres(connectionString, { prepare: false })
  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  }
}
