import {
  AgentAccessEventPageSizeSchema,
  AgentAccessPageSizeSchema,
  requireAgentAccessProjectId,
} from "@flowmark/auth/agent-access"
import { PeerSelectionSchema } from "@flowmark/api"
import { Effect, Schema } from "effect"
import { McpToolInputError } from "../errors.js"

const ProjectIdSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(64)),
)

const WorkflowNameSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
)

export const ListWorkflowsInputSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(AgentAccessPageSizeSchema),
  workflow: Schema.optional(WorkflowNameSchema),
  revision: Schema.optional(Schema.String),
  meaningCursor: Schema.optional(Schema.String),
})

export type ListWorkflowsInput = typeof ListWorkflowsInputSchema.Type

export const FindRunsInputSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  startedAfter: Schema.String,
  startedBefore: Schema.String,
  workflow: Schema.optional(WorkflowNameSchema),
  status: Schema.optional(Schema.Literals(["Completed", "Failed", "Running"])),
  search: Schema.optional(
    Schema.String.pipe(Schema.check(Schema.isMaxLength(200))),
  ),
  externalId: Schema.optional(Schema.String),
  correlationId: Schema.optional(Schema.String),
  parentRunId: Schema.optional(Schema.String),
  environment: Schema.optional(Schema.String),
  release: Schema.optional(Schema.String),
  failCode: Schema.optional(Schema.String),
  namespace: Schema.optional(Schema.Literals(["browser", "application"])),
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(AgentAccessPageSizeSchema),
}).check(
  Schema.makeFilter(
    (input) =>
      input.startedAfter.trim().length > 0 &&
      input.startedBefore.trim().length > 0,
  ),
)

export type FindRunsInput = typeof FindRunsInputSchema.Type

const RunIdSchema = Schema.String.pipe(
  Schema.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
)

export const GetRunInputSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  runId: RunIdSchema,
  section: Schema.optional(
    Schema.Literals(["events", "related", "expectations", "operations"]),
  ),
  cursor: Schema.optional(Schema.String),
  limit: Schema.optional(AgentAccessEventPageSizeSchema),
})

export type GetRunInput = typeof GetRunInputSchema.Type

export const CompareRunInputSchema = Schema.Struct({
  projectId: ProjectIdSchema,
  runId: RunIdSchema,
  peers: Schema.optional(PeerSelectionSchema),
})

export type CompareRunInput = typeof CompareRunInputSchema.Type

export const decodeListWorkflowsInput = Effect.fn(
  "McpSchemas.decodeListWorkflowsInput",
)(function* (value: unknown) {
  const input = yield* Schema.decodeUnknownEffect(ListWorkflowsInputSchema)(
    value,
  ).pipe(
    Effect.mapError(
      () =>
        new McpToolInputError({
          reason:
            "list_workflows requires projectId; optional limit is 1–100; workflow names are bounded.",
        }),
    ),
  )
  yield* requireAgentAccessProjectId("list_workflows", input.projectId)
  return input
})

export const decodeFindRunsInput = Effect.fn("McpSchemas.decodeFindRunsInput")(
  function* (value: unknown) {
    const input = yield* Schema.decodeUnknownEffect(FindRunsInputSchema)(
      value,
    ).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "find_runs requires projectId, startedAfter, and startedBefore within agent history bounds.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("find_runs", input.projectId)
    return input
  },
)

export const decodeGetRunInput = Effect.fn("McpSchemas.decodeGetRunInput")(
  function* (value: unknown) {
    const input = yield* Schema.decodeUnknownEffect(GetRunInputSchema)(
      value,
    ).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "get_run requires projectId and runId. section is events, related, expectations, or operations. limit is 1–100.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("get_run", input.projectId)
    return input
  },
)

export const decodeCompareRunInput = Effect.fn(
  "McpSchemas.decodeCompareRunInput",
)(function* (value: unknown) {
  const input = yield* Schema.decodeUnknownEffect(CompareRunInputSchema)(
    value,
  ).pipe(
    Effect.mapError(
      () =>
        new McpToolInputError({
          reason:
            "compare_run requires projectId and runId. Peer days are 1–90, and a dimension key requires a dimension value.",
        }),
    ),
  )
  yield* requireAgentAccessProjectId("compare_run", input.projectId)
  return input
})
