import { constants, copyFileSync, existsSync } from "node:fs"
import console from "node:console"
import process from "node:process"
import { join } from "node:path"

for (const app of ["server", "dashboard", "dev-harness"]) {
  const directory = join(process.cwd(), "apps", app)
  const destination = join(directory, ".env.local")
  if (existsSync(join(directory, ".env"))) {
    console.log(`[Flowmark dev] ${app}: keeping existing .env configuration.`)
    continue
  }
  try {
    copyFileSync(
      join(directory, ".env.example"),
      destination,
      constants.COPYFILE_EXCL,
    )
    console.log(
      `[Flowmark dev] Created apps/${app}/.env.local from the public local-demo template.`,
    )
  } catch (error) {
    if (error.code !== "EEXIST") {
      throw error
    }
  }
}

console.log(
  "[Flowmark dev] Start PostgreSQL with pnpm infra up (Compose) or your existing native setup. Check apps/server/.env.local and run pnpm db:setup once before recording data. Existing configuration is preserved.",
)
