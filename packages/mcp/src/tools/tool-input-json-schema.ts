import { AGENT_ACCESS_QUERY_BOUNDS } from "@flowmark/auth/agent-access"
import type { JsonSchemaType } from "@modelcontextprotocol/server"

const pageLimitSchema = {
  type: "integer",
  minimum: 1,
  maximum: AGENT_ACCESS_QUERY_BOUNDS.maxPageSize,
} as const satisfies JsonSchemaType

export const listWorkflowsInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId"],
  properties: {
    projectId: { type: "string", minLength: 1, maxLength: 64 },
    cursor: { type: "string" },
    limit: pageLimitSchema,
    workflow: { type: "string", minLength: 1, maxLength: 200 },
    revision: { type: "string" },
    meaningCursor: { type: "string" },
  },
} as const satisfies JsonSchemaType

export const findRunsInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "startedAfter", "startedBefore"],
  properties: {
    projectId: { type: "string", minLength: 1, maxLength: 64 },
    startedAfter: { type: "string", minLength: 1 },
    startedBefore: { type: "string", minLength: 1 },
    workflow: { type: "string", minLength: 1, maxLength: 200 },
    status: { type: "string", enum: ["Completed", "Failed", "Running"] },
    search: { type: "string", maxLength: 200 },
    externalId: { type: "string" },
    correlationId: { type: "string" },
    parentRunId: { type: "string" },
    environment: { type: "string" },
    release: { type: "string" },
    failCode: { type: "string" },
    namespace: { type: "string", enum: ["browser", "application"] },
    cursor: { type: "string" },
    limit: pageLimitSchema,
  },
} as const satisfies JsonSchemaType
