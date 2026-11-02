import process from "node:process"
import { Effect } from "effect"
import { assertManagedLocalDatabase } from "./managed-local-database.js"
import { readDatabaseUrl } from "./runtime.js"

export const readLocalDevelopmentDatabaseUrl = Effect.fn(
  "readLocalDevelopmentDatabaseUrl",
)(function* (env: NodeJS.ProcessEnv = process.env) {
  const url = yield* readDatabaseUrl(env)
  yield* assertManagedLocalDatabase(url, env)
  return url
})
