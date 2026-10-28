import process from "node:process"
import { Cause, Effect } from "effect"
import {
  CommandConfigurationError,
  DemoModeRequiredError,
  LoopbackDatabaseError,
  MissingDatabaseUrlError,
  MissingMigrationUrlError,
  PreviewBaselineError,
  ProductionEnvironmentError,
} from "../environment/error.js"
import { DatabaseError } from "../persistence/database.js"

const reportReason = (error: { readonly reason: string }) =>
  Effect.sync(() => {
    console.error(error.reason)
    process.exitCode = 1
  })

export const runDatabaseCommand = <A>(
  command: Effect.Effect<
    A,
    | CommandConfigurationError
    | DemoModeRequiredError
    | LoopbackDatabaseError
    | MissingDatabaseUrlError
    | MissingMigrationUrlError
    | PreviewBaselineError
    | ProductionEnvironmentError
    | DatabaseError
  >,
) =>
  Effect.runPromise(
    command.pipe(
      Effect.asVoid,
      Effect.catchTags({
        CommandConfigurationError: reportReason,
        DemoModeRequiredError: reportReason,
        LoopbackDatabaseError: reportReason,
        MissingDatabaseUrlError: reportReason,
        MissingMigrationUrlError: reportReason,
        PreviewBaselineError: reportReason,
        ProductionEnvironmentError: reportReason,
        DatabaseError: (error) =>
          Effect.sync(() => {
            console.error(`Database ${error.operation} failed.`)
            process.exitCode = 1
          }),
      }),
      Effect.catchAllCause((cause) =>
        Effect.sync(() => {
          console.error(Cause.pretty(cause))
          process.exitCode = 1
        }),
      ),
    ),
  )
