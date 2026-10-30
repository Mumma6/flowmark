import { spawnSync } from "node:child_process"

/** Same checked environment for history preflight, migration and verification. */
export function runMigrationSteps(cwd, env) {
  for (const args of [
    ["--filter", "@flowmark/db", "db:migrations:verify", "--allow-pending"],
    ["--filter", "@flowmark/db", "db:migrate"],
    ["--filter", "@flowmark/db", "db:migrations:verify"],
  ]) {
    const result = spawnSync("pnpm", args, { cwd, stdio: "inherit", env })
    if (result.status !== 0) {
      return result.status ?? 1
    }
  }
  return 0
}
