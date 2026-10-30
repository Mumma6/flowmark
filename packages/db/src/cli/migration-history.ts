import { Effect } from "effect"
import { CommandConfigurationError } from "../environment/error.js"

/** Applied history must be an exact prefix of the reviewed commit. */
export const verifyMigrationHistory = Effect.fn("verifyMigrationHistory")((
  expected: readonly {
    readonly hash: string
    readonly folderMillis: number
  }[],
  actual: readonly {
    readonly hash: string
    readonly created_at: string | number
  }[],
  allowPending: boolean,
): Effect.Effect<void, CommandConfigurationError> => {
  const matches =
    actual.length <= expected.length &&
    actual.every(
      (row, index) =>
        row.hash === expected[index]?.hash &&
        Number(row.created_at) === expected[index]?.folderMillis,
    )
  return matches && (allowPending || actual.length === expected.length)
    ? Effect.void
    : Effect.fail(
        new CommandConfigurationError({
          reason:
            "Migration history differs from the reviewed commit or required migrations are pending. Refusing rollout; inspect schema and history before continuing.",
        }),
      )
})
