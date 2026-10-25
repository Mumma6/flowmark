import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { fileURLToPath } from "node:url"

export function loadApiEnvironment() {
  for (const name of [".env.local", ".env"]) {
    const path = fileURLToPath(
      new URL(`../../../apps/server/${name}`, import.meta.url),
    )
    if (existsSync(path)) {
      loadEnvFile(path)
    }
  }
}
