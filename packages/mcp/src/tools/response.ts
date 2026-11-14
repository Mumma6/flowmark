import {
  AGENT_ACCESS_QUERY_BOUNDS,
  AgentAccessContractError,
} from "@flowmark/auth/agent-access"
import { InvalidInput, Unauthorized, type EngineError } from "@flowmark/api"
import { Effect, Match, Option, Predicate } from "effect"
import {
  McpConfigurationError,
  McpConnectionResolveError,
  McpToolInputError,
  McpToolReadError,
} from "../errors.js"

const msPerDay = 86_400_000

const invalidTimestamps = () =>
  new McpToolInputError({
    reason: "startedAfter and startedBefore must be valid ISO-8601 timestamps.",
  })

const invertedWindow = () =>
  new McpToolInputError({
    reason: "startedBefore must be on or after startedAfter.",
  })

const windowTooWide = () =>
  new McpToolInputError({
    reason: `History window cannot exceed ${AGENT_ACCESS_QUERY_BOUNDS.maxHistoryWindowDays} days.`,
  })

const responseTooLarge = () =>
  mcpToolError(
    "Response exceeds the maximum serialized size; narrow the query or page.",
  )

const invalidInputMessage = (cause: unknown) =>
  Match.value(cause).pipe(
    Match.when(Predicate.isString, (message) => message),
    Match.when(Predicate.isError, (error) => error.message),
    Match.orElse(
      () => "The request filters or cursor are not valid for this project.",
    ),
  )

const parsedInstant = (value: string) =>
  Option.liftPredicate(Date.parse(value), Number.isFinite)

export const mcpToolError = (message: string, accessUnavailable = false) => ({
  ...(accessUnavailable
    ? { _meta: { "io.flowmark/evidence": { state: "access-unavailable" } } }
    : {}),
  isError: true as const,
  content: [{ type: "text" as const, text: message }],
})

const formatToolResult = (structured: Record<string, unknown>) => ({
  content: [{ type: "text" as const, text: JSON.stringify(structured) }],
  structuredContent: structured,
})

export const mcpResultFits = (structured: Record<string, unknown>) =>
  new TextEncoder().encode(JSON.stringify(formatToolResult(structured)))
    .byteLength <= AGENT_ACCESS_QUERY_BOUNDS.maxSerializedResponseBytes

export const mcpToolResult = (structured: Record<string, unknown>) =>
  mcpResultFits(structured) ? formatToolResult(structured) : responseTooLarge()

export type McpToolFailure =
  | EngineError
  | InvalidInput
  | Unauthorized
  | AgentAccessContractError
  | McpToolInputError
  | McpToolReadError
  | McpConnectionResolveError
  | McpConfigurationError

const toolError = (message: string, accessUnavailable = false) =>
  Effect.succeed(mcpToolError(message, accessUnavailable))

export const presentMcpTool = <A extends Record<string, unknown>, R>(
  effect: Effect.Effect<A, McpToolFailure, R>,
) =>
  effect.pipe(
    Effect.map((value) => mcpToolResult(value)),
    Effect.catchTags({
      EngineError: () => toolError("Evidence analysis is unavailable."),
      InvalidInput: (error) => toolError(invalidInputMessage(error.cause)),
      Unauthorized: () =>
        toolError(
          "This project is not authorized for the current agent connection.",
          true,
        ),
      AgentAccessContractError: (error) => toolError(error.reason),
      McpToolInputError: (error) => toolError(error.reason),
      McpToolReadError: (error) => toolError(error.reason),
      McpConnectionResolveError: (error) => toolError(error.reason, true),
      McpConfigurationError: (error) => toolError(error.reason),
    }),
  )

export const assertHistoryWindow = Effect.fn("McpTools.assertHistoryWindow")(
  function* (startedAfter: string, startedBefore: string) {
    const startMs = yield* parsedInstant(startedAfter).pipe(
      Effect.fromOption(invalidTimestamps),
    )
    const endMs = yield* parsedInstant(startedBefore).pipe(
      Effect.fromOption(invalidTimestamps),
    )
    const spanDays = (endMs - startMs) / msPerDay
    yield* Option.liftPredicate(invertedWindow(), () => endMs < startMs).pipe(
      Option.match({
        onNone: () => Effect.void,
        onSome: Effect.fail,
      }),
    )
    return yield* Option.liftPredicate(
      windowTooWide(),
      () => spanDays > AGENT_ACCESS_QUERY_BOUNDS.maxHistoryWindowDays,
    ).pipe(
      Option.match({
        onNone: () => Effect.void,
        onSome: Effect.fail,
      }),
    )
  },
)
