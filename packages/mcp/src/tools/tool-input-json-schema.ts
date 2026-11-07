import { AGENT_ACCESS_QUERY_BOUNDS } from "@flowmark/auth/agent-access"
import type { JsonSchemaType } from "@modelcontextprotocol/server"

export const connectionInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {},
} as const satisfies JsonSchemaType

const pageLimitSchema = {
  type: "integer",
  minimum: 1,
  maximum: AGENT_ACCESS_QUERY_BOUNDS.maxPageSize,
} as const satisfies JsonSchemaType

const eventPageLimitSchema = {
  type: "integer",
  minimum: 1,
  maximum: AGENT_ACCESS_QUERY_BOUNDS.maxEventPageSize,
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

export const getRunInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "runId"],
  properties: {
    projectId: { type: "string", minLength: 1, maxLength: 64 },
    runId: { type: "string", minLength: 1, maxLength: 200 },
    section: {
      type: "string",
      enum: ["events", "related", "expectations", "operations"],
    },
    cursor: { type: "string" },
    limit: eventPageLimitSchema,
  },
} as const satisfies JsonSchemaType

export const compareRunInputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["projectId", "runId"],
  properties: {
    projectId: { type: "string", minLength: 1, maxLength: 64 },
    runId: { type: "string", minLength: 1, maxLength: 200 },
    peers: {
      type: "object",
      additionalProperties: false,
      properties: {
        days: { type: "integer", minimum: 1, maximum: 90 },
        environment: { type: "string", enum: ["same", "all"] },
        sameRelease: { type: "boolean" },
        dimensionKey: { type: "string", minLength: 1, maxLength: 128 },
        dimensionValue: { type: "string", maxLength: 2048 },
      },
    },
  },
} as const satisfies JsonSchemaType
