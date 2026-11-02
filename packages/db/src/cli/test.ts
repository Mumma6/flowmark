import process from "node:process"
import { readdirSync } from "node:fs"
import { basename } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Result } from "effect"
import { CommandConfigurationError } from "../environment/error.js"
import { integrationCommand } from "./integration-command.js"
import { runDisposableIntegration } from "./test-integration.js"

const packageRoot = fileURLToPath(new URL("../../", import.meta.url))

const runDatabaseTests = Effect.fn("runDatabaseTests")(function* (
  args: readonly string[],
) {
  const files = yield* Effect.try({
    try: () =>
      readdirSync(new URL("../../test", import.meta.url), { recursive: true })
        .filter(
          (file): file is string =>
            typeof file === "string" && file.endsWith(".test.ts"),
        )
        .sort()
        .map((file) => `test/${file}`),
    catch: () =>
      new CommandConfigurationError({
        reason: "Cannot discover database tests.",
      }),
  })
  if (!files.length) {
    return yield* new CommandConfigurationError({
      reason: "No database tests were found.",
    })
  }
  yield* integrationCommand(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      "./test/setup.ts",
      "--test",
      ...args.filter((arg) => arg !== "--"),
      ...files,
    ],
    { cwd: packageRoot, env: process.env },
  )
})

if (["test.ts", "test.js"].includes(basename(process.argv[1] ?? ""))) {
  const controller = new AbortController()
  let interrupted = 0
  let failure = 0
  const interrupt = (code: number) => {
    interrupted ||= code
    controller.abort()
  }
  const sigint = () => interrupt(130)
  const sigterm = () => interrupt(143)
  // Package-manager wrappers may forward a signal more than once. Keep the
  // handlers installed until scoped process/container cleanup has completed.
  process.on("SIGINT", sigint)
  process.on("SIGTERM", sigterm)
  const program =
    process.argv[2] === "integration"
      ? runDisposableIntegration(process.argv.slice(3), (code) => {
          failure ||= code
        })
      : runDatabaseTests(process.argv.slice(2))
  try {
    const result = await Effect.runPromise(
      Effect.result(Effect.scoped(program)),
      { signal: controller.signal },
    )
    Result.match(result, {
      onFailure: (error) => {
        console.error(error.reason)
        process.exitCode = "exitCode" in error ? error.exitCode : 1
      },
      onSuccess: () => undefined,
    })
  } catch {
    process.exitCode = interrupted || failure || 1
    if (!interrupted) {
      console.error(
        "Integration execution or cleanup failed. Inspect the reported run identity and saved diagnostics.",
      )
    }
  } finally {
    if (interrupted) {
      process.exitCode = interrupted
    }
    process.off("SIGINT", sigint)
    process.off("SIGTERM", sigterm)
  }
}
