import { AGENT_ACCESS_QUERY_BOUNDS } from "@flowmark/auth/agent-access"
import type { InvalidInput, Unauthorized } from "@flowmark/api"
import { Effect } from "effect"
import { McpToolInputError, McpToolReadError } from "../errors.js"

export const mcpToolResult = (structured: Record<string, unknown>) => {
  const text = JSON.stringify(structured)
  if (text.length > AGENT_ACCESS_QUERY_BOUNDS.maxSerializedResponseBytes) {
    return mcpToolError(
      "Response exceeds the maximum serialized size; narrow the query or page.",
    )
  }
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: structured,
  }
}

export const mcpToolError = (message: string) => ({
  isError: true as const,
  content: [{ type: "text" as const, text: message }],
})

export const mapWorkflowReadFailure = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    (error as { _tag: string })._tag === "InvalidInput" &&
    "cause" in error
  ) {
    const cause = (error as InvalidInput).cause
    const message =
      typeof cause === "string"
        ? cause
        : cause instanceof Error
          ? cause.message
          : "The request filters or cursor are not valid for this project."
    return mcpToolError(message)
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    (error as Unauthorized)._tag === "Unauthorized"
  ) {
    return mcpToolError(
      "This project is not authorized for the current agent connection.",
    )
  }
  if (error instanceof McpToolInputError) {
    return mcpToolError(error.reason)
  }
  if (error instanceof McpToolReadError) {
    return mcpToolError(error.reason)
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    (error as { _tag: string })._tag === "McpConnectionResolveError" &&
    "reason" in error
  ) {
    return mcpToolError(String((error as { reason: string }).reason))
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    (error as { _tag: string })._tag === "McpConfigurationError" &&
    "reason" in error
  ) {
    return mcpToolError(String((error as { reason: string }).reason))
  }
  return mcpToolError("The workflow read could not be completed.")
}

export const assertHistoryWindow = Effect.fn("McpTools.assertHistoryWindow")(
  function* (startedAfter: string, startedBefore: string) {
    const startMs = Date.parse(startedAfter)
    const endMs = Date.parse(startedBefore)
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return yield* new McpToolInputError({
        reason:
          "startedAfter and startedBefore must be valid ISO-8601 timestamps.",
      })
    }
    if (endMs < startMs) {
      return yield* new McpToolInputError({
        reason: "startedBefore must be on or after startedAfter.",
      })
    }
    const spanDays = (endMs - startMs) / 86_400_000
    if (spanDays > AGENT_ACCESS_QUERY_BOUNDS.maxHistoryWindowDays) {
      return yield* new McpToolInputError({
        reason: `History window cannot exceed ${AGENT_ACCESS_QUERY_BOUNDS.maxHistoryWindowDays} days.`,
      })
    }
  },
)
