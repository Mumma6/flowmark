import { requireAgentAccessProjectId } from "@flowmark/auth/agent-access"
import {
  CoverageAssessmentInputSchema,
  CoverageObservationQuerySchema,
  assessCoverage,
  GetProjectWorkflowData,
} from "@flowmark/api"
import { Effect, Schema } from "effect"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"
import { McpToolInputError, McpToolReadError } from "../../errors.js"
import { resolveMcpGrantFamily } from "../delegated/grant-family.js"
import { mcpDelegatedReader } from "../delegated/reader.js"

const ClientInput = Schema.Struct({
  version: Schema.Literal(1),
  projectId: Schema.String.check(Schema.isUUID()),
  questionId: CoverageAssessmentInputSchema.fields.questionId,
  questionRevision: CoverageAssessmentInputSchema.fields.questionRevision,
  release: CoverageAssessmentInputSchema.fields.release,
  behaviorRevision: CoverageAssessmentInputSchema.fields.behaviorRevision,
  environment: CoverageAssessmentInputSchema.fields.environment,
  provenance: CoverageAssessmentInputSchema.fields.provenance,
  populationSource: CoverageAssessmentInputSchema.fields.populationSource,
  window: CoverageAssessmentInputSchema.fields.window,
  maturityDelayMs: CoverageAssessmentInputSchema.fields.maturityDelayMs,
  observedAt: CoverageAssessmentInputSchema.fields.observedAt,
  supportExpiresAt: CoverageAssessmentInputSchema.fields.supportExpiresAt,
  sampling: CoverageAssessmentInputSchema.fields.sampling,
  join: CoverageAssessmentInputSchema.fields.join,
  drilldownLimit: CoverageAssessmentInputSchema.fields.drilldownLimit,
  permittedHandles: CoverageAssessmentInputSchema.fields.permittedHandles,
  discovery: CoverageAssessmentInputSchema.fields.discovery,
  readiness: CoverageAssessmentInputSchema.fields.readiness,
  population: CoverageAssessmentInputSchema.fields.population,
  deliveries: CoverageAssessmentInputSchema.fields.deliveries,
})

export const AssessCoverageSchema = ClientInput

export const assessCoverageForMcp = Effect.fn("AssessCoverage.execute")(
  function* (identity: FlowmarkMcpAuthInfo, raw: unknown) {
    const input = yield* Schema.decodeUnknownEffect(ClientInput, {
      onExcessProperty: "error",
    })(raw).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason:
              "Supply version 1, an authorized project, one question, its population and the observation window.",
          }),
      ),
    )
    yield* requireAgentAccessProjectId("assess_coverage", input.projectId)
    const family = yield* resolveMcpGrantFamily(identity)
    const reads = yield* GetProjectWorkflowData
    const scope = yield* Schema.decodeUnknownEffect(
      CoverageObservationQuerySchema,
    )({
      environment: input.environment,
      artifactDigest: input.release,
      behaviorRevision: input.behaviorRevision,
      startedAt: input.window.start,
      endedAt: input.window.end,
    }).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason: "The coverage window is outside the supported contract.",
          }),
      ),
    )
    const stored = yield* reads
      .coverageObservations(
        mcpDelegatedReader(identity, family.familyId, input.projectId),
        scope,
      )
      .pipe(
        Effect.catchTags({
          PersistenceError: () =>
            Effect.fail(
              new McpToolReadError({
                reason: "Scoped coverage observations could not be read.",
              }),
            ),
          Unauthorized: () =>
            Effect.fail(
              new McpToolReadError({
                reason: "This grant cannot read coverage for that project.",
              }),
            ),
        }),
      )
    const assessment = yield* assessCoverage({
      ...input,
      stored: stored.events,
      storedTruncated: stored.truncated,
    }).pipe(
      Effect.mapError(
        () =>
          new McpToolInputError({
            reason: "The coverage input is outside the supported contract.",
          }),
      ),
    )
    return {
      tool: "assess_coverage" as const,
      version: input.version,
      projectId: input.projectId,
      assessment,
    }
  },
)

export type AssessCoverageRequirements = GetProjectWorkflowData
