import { Data } from "effect"

export class AgentAccessRuntimeError extends Data.TaggedError(
  "AgentAccessRuntimeError",
)<{
  readonly reason: string
}> {}

export class McpConfigurationError extends Data.TaggedError(
  "McpConfigurationError",
)<{
  readonly reason: string
}> {}

export class McpDiscoveryError extends Data.TaggedError("McpDiscoveryError")<{
  readonly reason: string
}> {}

export class McpConnectionResolveError extends Data.TaggedError(
  "McpConnectionResolveError",
)<{
  readonly reason: string
}> {}

export class McpToolInputError extends Data.TaggedError("McpToolInputError")<{
  readonly reason: string
}> {}

export class McpToolReadError extends Data.TaggedError("McpToolReadError")<{
  readonly reason: string
}> {}
