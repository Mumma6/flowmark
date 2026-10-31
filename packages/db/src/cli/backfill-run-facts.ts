import { createHash } from "node:crypto"
import { readFile, rename, writeFile } from "node:fs/promises"
import { Data, Effect, Schema } from "effect"
import { CommandConfigurationError } from "../environment/error.js"
import {
  readDatabaseUrl,
  isProductionEnvironment,
} from "../environment/runtime.js"
import { Database } from "../persistence/database.js"
import { backfillRunFacts } from "../persistence/workflows/writes/backfill-run-facts.js"
import { withCommandDatabase } from "./connection.js"
import { runDatabaseCommand } from "./run.js"
import { FactCheckpoint, readRunFactsOptions } from "./run-facts-options.js"

class CheckpointReadError extends Data.TaggedError("CheckpointReadError")<{
  readonly code: string | undefined
}> {}

const fileError = () =>
  new CommandConfigurationError({
    reason:
      "Cannot read/write run-facts checkpoint. Check its path and format; no cursor was advanced.",
  })

await runDatabaseCommand(
  Effect.gen(function* () {
    // Deliberately do not load an env file: target must be supplied explicitly.
    const url = yield* readDatabaseUrl()
    const targetUrl = yield* Effect.try({
      try: () => new URL(url),
      catch: () =>
        new CommandConfigurationError({ reason: "Invalid database URL." }),
    })
    if (
      isProductionEnvironment() ||
      !["postgres:", "postgresql:"].includes(targetUrl.protocol) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(targetUrl.hostname)
    ) {
      return yield* new CommandConfigurationError({
        reason:
          "Run-facts backfill only accepts an explicit loopback development database. Hosted backfill requires a separately approved operator procedure.",
      })
    }
    const options = yield* readRunFactsOptions(process.argv.slice(2))
    const target = createHash("sha256").update(url).digest("hex")
    let after = options.after
    if (options.checkpoint) {
      const contents = yield* Effect.tryPromise({
        try: () => readFile(options.checkpoint!, "utf8"),
        catch: (cause) =>
          new CheckpointReadError({
            code: (cause as NodeJS.ErrnoException).code,
          }),
      }).pipe(
        Effect.catchTag("CheckpointReadError", (error) =>
          error.code === "ENOENT"
            ? Effect.succeed(null)
            : Effect.fail(fileError()),
        ),
      )
      if (contents !== null) {
        const decoded = yield* Effect.try({
          try: () => JSON.parse(contents) as unknown,
          catch: fileError,
        })
        const checkpoint = yield* Schema.decodeUnknownEffect(FactCheckpoint)(
          decoded,
        ).pipe(Effect.mapError(fileError))
        if (
          checkpoint.target !== target ||
          checkpoint.project !== options.project
        ) {
          return yield* new CommandConfigurationError({
            reason: "Checkpoint belongs to another database or project.",
          })
        }
        after = checkpoint.after
      }
    }
    yield* withCommandDatabase(url, (db) =>
      Effect.gen(function* () {
        let inspected = 0
        while (inspected < options.maxRuns) {
          const page = yield* backfillRunFacts(
            options.project,
            after,
            Math.min(options.batchSize, options.maxRuns - inspected),
            options.apply,
          ).pipe(Effect.provideService(Database, db))
          inspected += page.inspected
          after = page.after
          // Dry-run never changes checkpoint files. A crash after DB commit just replays an idempotent page.
          if (options.apply && options.checkpoint && page.inspected > 0) {
            const path = options.checkpoint
            yield* Effect.tryPromise({
              try: () =>
                writeFile(
                  path + ".tmp",
                  JSON.stringify({
                    version: 1,
                    target,
                    project: options.project,
                    after,
                  }) + "\n",
                  { mode: 0o600 },
                ),
              catch: fileError,
            })
            yield* Effect.tryPromise({
              try: () => rename(path + ".tmp", path),
              catch: fileError,
            })
          }
          yield* Effect.sync(() =>
            console.log(
              JSON.stringify({
                mode: options.apply ? "apply" : "dry-run",
                ...page,
              }),
            ),
          )
          if (
            page.inspected <
            Math.min(
              options.batchSize,
              options.maxRuns - inspected + page.inspected,
            )
          ) {
            break
          }
        }
        yield* Effect.sync(() =>
          console.log(
            JSON.stringify({
              inspected,
              after,
              budgetReached: inspected === options.maxRuns,
              note: "Restart from the beginning with a new checkpoint for final reconciliation after old writers stop.",
            }),
          ),
        )
      }),
    )
  }),
)
