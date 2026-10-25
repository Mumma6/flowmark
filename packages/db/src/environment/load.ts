import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"

export const loadApiEnvironment = Effect.sync(() => {
  for (const name of [".env.local", ".env"]) {
    const path = fileURLToPath(
      new URL(`../../../../apps/server/${name}`, import.meta.url),
    )
    if (existsSync(path)) {
      loadEnvFile(path)
    }
  }
})
