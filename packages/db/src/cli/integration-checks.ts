import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Effect } from "effect"
import { CommandConfigurationError } from "../environment/error.js"
import { assertTestDatabaseTarget } from "../environment/test-database.js"
import { localProject } from "../environment/local-infrastructure.js"
import { integrationCommand, redactTestOutput } from "./integration-command.js"
import {
  verifyDatabaseReport,
  verifyServerReport,
} from "./integration-reports.js"

export const runIntegrationChecks = Effect.fn("runIntegrationChecks")(
  function* (
    root: string,
    env: NodeJS.ProcessEnv,
    directory: string,
    failed: (code: number) => void,
  ) {
    yield* assertTestDatabaseTarget(env)
    const lock = join(
      tmpdir(),
      `flowmark-integration-workspace-${localProject(root).checkout}`,
    )
    yield* Effect.acquireRelease(
      Effect.gen(function* () {
        for (let attempt = 0; attempt < 240; attempt++) {
          const acquired = yield* Effect.try({
            try: () => {
              try {
                mkdirSync(lock, { mode: 0o700 })
              } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "EEXIST") {
                  return false
                }
                throw error
              }
              try {
                writeFileSync(
                  join(lock, "owner.json"),
                  JSON.stringify({ pid: process.pid, reports: directory }),
                )
              } catch (error) {
                rmSync(lock, { recursive: true })
                throw error
              }
              return true
            },
            catch: () =>
              new CommandConfigurationError({
                reason: "Cannot acquire the integration workspace lock.",
              }),
          })
          if (acquired) {
            return lock
          }
          if (attempt === 0) {
            yield* Effect.sync(() =>
              console.log(
                `Waiting for native build/test workspace ownership: ${lock}`,
              ),
            )
          }
          yield* Effect.sleep("500 millis")
        }
        return yield* new CommandConfigurationError({
          reason: `Integration workspace is busy. Inspect ${lock}/owner.json; never delete an active owner's lock.`,
        })
      }),
      (path) => Effect.sync(() => rmSync(path, { recursive: true })),
    )
    yield* Effect.try({
      try: () => mkdirSync(directory, { recursive: true }),
      catch: () =>
        new CommandConfigurationError({
          reason: "Cannot create the integration report directory.",
        }),
    })
    const command = (args: readonly string[]) =>
      integrationCommand("pnpm", args, {
        cwd: root,
        env,
        log: join(directory, "commands.log"),
        detached: true,
        failed,
      })
    yield* command([
      "--filter",
      "@flowmark/api...",
      "--filter",
      "@flowmark/auth...",
      "--filter",
      "@flowmark/mcp...",
      "--filter",
      "@flowmark/demo...",
      "build",
    ])
    yield* command(["db:migrate"])
    yield* command([
      "--filter",
      "@flowmark/db",
      "test",
      "--test-reporter=tap",
      `--test-reporter-destination=${join(directory, "db.tap")}`,
    ]).pipe(
      Effect.tapError(() =>
        Effect.sync(() => {
          try {
            const lines = readFileSync(join(directory, "db.tap"), "utf8").split(
              "\n",
            )
            const failed = lines.findIndex((line) =>
              /^\s*not ok \d+ /.test(line),
            )
            const context =
              failed < 0
                ? []
                : lines.slice(Math.max(0, failed - 2), failed + 70)
            const excerpt = [...context, ...lines.slice(-30)]
              .join("\n")
              .slice(0, 12000)
            console.error(
              `Database test failure (first failure and summary):\n${redactTestOutput(excerpt)}`,
            )
          } catch {
            console.error("Database failure report could not be read.")
          }
        }),
      ),
    )
    const tap = yield* Effect.try({
      try: () => readFileSync(join(directory, "db.tap"), "utf8"),
      catch: () =>
        new CommandConfigurationError({
          reason: "The database test report is missing.",
        }),
    })
    yield* verifyDatabaseReport(tap)
    yield* command(["--filter", "@flowmark/auth", "test"])
    yield* command([
      "--filter",
      "@flowmark/server",
      "test",
      "--reporter=default",
      "--reporter=json",
      `--outputFile=${join(directory, "server.json")}`,
    ])
    const server = yield* Effect.try({
      try: (): unknown =>
        JSON.parse(readFileSync(join(directory, "server.json"), "utf8")),
      catch: () =>
        new CommandConfigurationError({
          reason: "The server test report is missing or invalid.",
        }),
    })
    yield* verifyServerReport(server)
    yield* command(["--filter", "@flowmark/demo", "test"])
  },
)
