import process from "node:process"
import { Cause, Effect } from "effect"
import { CommandConfigurationError } from "../environment/error.js"
import { DatabaseError } from "../persistence/database.js"

export const runDatabaseCommand = <A>(
  command: Effect.Effect<A, CommandConfigurationError | DatabaseError>,
) =>
  Effect.runPromise(
    command.pipe(
      Effect.asVoid,
      Effect.catchTags({
        CommandConfigurationError: (error) =>
          Effect.sync(() => {
            console.error(error.reason)
            process.exitCode = 1
          }),
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
