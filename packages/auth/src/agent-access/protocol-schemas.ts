import { Effect, Schema } from "effect"
import { AgentAccessContractError } from "./contract-errors.js"
import {
  AGENT_ACCESS_MCP_TOOLS,
  AGENT_ACCESS_OAUTH_SCOPE_READ,
  AGENT_ACCESS_QUERY_BOUNDS,
} from "./protocol-constants.js"

export const AgentAccessMcpToolNameSchema = Schema.Literals([
  ...AGENT_ACCESS_MCP_TOOLS,
])

export type AgentAccessMcpToolNameFromSchema =
  typeof AgentAccessMcpToolNameSchema.Type

export const AgentAccessOAuthReadScopeSchema = Schema.Literal(
  AGENT_ACCESS_OAUTH_SCOPE_READ,
)

export const AgentAccessOriginsInputSchema = Schema.Struct({
  dashboardOrigin: Schema.String,
  apiOrigin: Schema.String,
})

export const AgentAccessPageSizeSchema = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: 1,
      maximum: AGENT_ACCESS_QUERY_BOUNDS.maxPageSize,
    }),
  ),
)

export const AgentAccessEventPageSizeSchema = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: 1,
      maximum: AGENT_ACCESS_QUERY_BOUNDS.maxEventPageSize,
    }),
  ),
)

export const AgentAccessHistoryWindowDaysSchema = Schema.Number.pipe(
  Schema.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: 1,
      maximum: AGENT_ACCESS_QUERY_BOUNDS.maxHistoryWindowDays,
    }),
  ),
)

const contractDecodeError = (reason: string) =>
  Effect.mapError(
    () =>
      new AgentAccessContractError({
        reason,
      }),
  )

export const decodeAgentAccessMcpToolName = Effect.fn(
  "AgentAccess.decodeMcpToolName",
)(function* (value: unknown) {
  return yield* Schema.decodeUnknownEffect(AgentAccessMcpToolNameSchema)(
    value,
  ).pipe(contractDecodeError("Unknown or invalid MCP tool name."))
})

export const decodeAgentAccessPageSize = Effect.fn(
  "AgentAccess.decodePageSize",
)(function* (value: unknown) {
  return yield* Schema.decodeUnknownEffect(AgentAccessPageSizeSchema)(
    value,
  ).pipe(
    contractDecodeError(
      `Page size must be an integer from 1 to ${AGENT_ACCESS_QUERY_BOUNDS.maxPageSize}.`,
    ),
  )
})
