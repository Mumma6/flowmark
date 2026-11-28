import {
  CoverageAssessmentInputSchema,
  assessLiveCoverage,
} from "@flowmarkdev/core"
import { Effect, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"
import type { ProjectReader } from "../models/project-reader.js"
import { GetProjectWorkflowData } from "./get-project-workflow-data.js"

export const StoredCoverageInputSchema = Schema.Struct({
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
  population: CoverageAssessmentInputSchema.fields.population,
})

export const assessCoverage = Effect.fn("assessCoverage")(function* (
  reader: ProjectReader,
  raw: unknown,
) {
  const input = yield* Schema.decodeUnknownEffect(StoredCoverageInputSchema, {
    onExcessProperty: "error",
  })(raw).pipe(
    Effect.mapError(
      () =>
        new InvalidInput({
          cause:
            "Coverage requires an independent population and rejects caller verdicts.",
        }),
    ),
  )
  const reads = yield* GetProjectWorkflowData
  const stored = yield* reads.coverageObservations(reader, {
    environment: input.environment,
    artifactDigest: input.release,
    behaviorRevision: input.behaviorRevision,
    startedAt: input.window.start,
    endedAt: input.window.end,
  })
  // Discovery reconciliation and fixture checks currently have no persisted result.
  // Their absence cannot establish matched discovery or verified readiness.
  return assessLiveCoverage({
    ...input,
    discovery: "unknown",
    readiness: "unknown",
    deliveries: [],
    stored: stored.events,
    storedTruncated: stored.truncated,
  })
})
