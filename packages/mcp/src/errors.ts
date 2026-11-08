import { Data } from "effect"

export class AgentAccessRuntimeError extends Data.TaggedError(
  "AgentAccessRuntimeError",
)<{
  readonly reason: string
  readonly cause?: unknown
}> {}

export class McpConfigurationError extends Data.TaggedError(
  "McpConfigurationError",
)<{
  readonly reason: string
  readonly cause?: unknown
}> {}

export class McpDiscoveryError extends Data.TaggedError("McpDiscoveryError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}

export class McpConnectionResolveError extends Data.TaggedError(
  "McpConnectionResolveError",
)<{
  readonly reason: string
  readonly cause?: unknown
}> {}

export class McpToolInputError extends Data.TaggedError("McpToolInputError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}

export class McpToolReadError extends Data.TaggedError("McpToolReadError")<{
  readonly reason: string
  readonly cause?: unknown
}> {}
