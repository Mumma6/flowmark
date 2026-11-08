import { Effect, Schema } from "effect"
import { McpToolReadError } from "../errors.js"
import { mcpResultFits, type McpToolFailure } from "./response.js"

/** Re-read a smaller real SQL page; never slice away rows and keep its old cursor. */
export const readPagedTool = <A extends Record<string, unknown>, R>(
  input: unknown,
  read: (input: unknown) => Effect.Effect<A, McpToolFailure, R>,
): Effect.Effect<A, McpToolFailure, R> => {
  const attempt = (
    value: unknown,
    limit: number,
  ): Effect.Effect<A, McpToolFailure, R> =>
    read(value).pipe(
      Effect.flatMap((result) => {
        if (mcpResultFits(result)) {
          return Effect.succeed(result)
        }
        return Schema.decodeUnknownEffect(
          Schema.Record(Schema.String, Schema.Unknown),
        )(value).pipe(
          Effect.mapError(
            () =>
              new McpToolReadError({ reason: "Invalid paginated tool input." }),
          ),
          Effect.flatMap((record) => {
            const effective =
              typeof record.limit === "number"
                ? Math.min(limit, record.limit)
                : limit
            if (effective <= 1) {
              return Effect.fail(
                new McpToolReadError({
                  reason:
                    "One evidence record exceeds the response budget. Request another bounded section.",
                }),
              )
            }
            const next = Math.max(1, Math.floor(effective / 2))
            return attempt({ ...record, limit: next }, next)
          }),
        )
      }),
    )
  return attempt(input, 100)
}
