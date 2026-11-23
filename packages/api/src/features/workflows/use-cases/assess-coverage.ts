import {
  CoverageAssessmentInputSchema,
  assessLiveCoverage,
  type CoverageAssessmentInput,
} from "@flowmarkdev/core"
import { Effect, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"

export const assessCoverage = (input: CoverageAssessmentInput) =>
  Schema.decodeUnknownEffect(CoverageAssessmentInputSchema)(input).pipe(
    Effect.map(assessLiveCoverage),
    Effect.mapError(
      () =>
        new InvalidInput({
          cause: "Coverage assessment input is outside the supported contract.",
        }),
    ),
  )
