import { AGENT_ACCESS_EXECUTION_BOUNDS as bounds } from "@flowmark/auth/agent-access"
import { ApiSettings, DatabaseLive, Unauthorized } from "@flowmark/api"
import { consumeMcpBudget } from "@flowmark/db/persistence"
import { Array, Effect, Layer, Match, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../auth/claims.js"
import { McpToolReadError } from "../errors.js"
import { resolveMcpConnection } from "../features/connection/resolve-connection.js"

const database = DatabaseLive.pipe(Layer.provide(ApiSettings.layer))
export const consumeAdmission = Effect.fn("Mcp.consumeAdmission")(
  function* (scope: string, maximum: number) {
    const decision = yield* consumeMcpBudget(scope, maximum)
    if (!decision.allowed) {
      return yield* new McpToolReadError({
        reason: `Read budget exhausted. Retry after ${decision.retryAfter ?? 60} seconds.`,
      })
    }
  },
  Effect.provide(database),
  Effect.timeoutOrElse({
    duration: bounds.statementTimeoutMs,
    orElse: () =>
      Effect.fail(
        new McpToolReadError({ reason: "Read admission is unavailable." }),
      ),
  }),
  Effect.mapError((cause) =>
    Match.value(cause).pipe(
      Match.tag("McpToolReadError", (error) => error),
      Match.orElse(
        (cause) =>
          new McpToolReadError({
            reason: "Read admission is unavailable.",
            cause,
          }),
      ),
    ),
  ),
)

export const admitTool = Effect.fn("Mcp.admitTool")(function* (
  identity: FlowmarkMcpAuthInfo,
  rawInput: unknown,
  projectScoped: boolean,
) {
  yield* consumeAdmission("service:tools", bounds.toolCallsPerServicePerMinute)
  const connection = yield* resolveMcpConnection(identity)
  yield* consumeAdmission(
    `grant:${identity.authorizationCodeId}`,
    bounds.toolCallsPerGrantPerMinute,
  )
  if (projectScoped) {
    const input = yield* Schema.decodeUnknownEffect(
      Schema.Struct({ projectId: Schema.NonEmptyString }),
    )(rawInput).pipe(
      Effect.mapError(
        () =>
          new McpToolReadError({
            reason: "An explicit projectId is required.",
          }),
      ),
    )
    if (
      !Array.some(
        connection.projects,
        (project) => project.id === input.projectId,
      )
    ) {
      return yield* new Unauthorized({ permission: "read" })
    }
    yield* consumeAdmission(
      `project:${input.projectId}`,
      bounds.toolCallsPerProjectPerMinute,
    )
  }
})
