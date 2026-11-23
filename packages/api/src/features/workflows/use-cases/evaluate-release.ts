import {
  ReleaseEvaluationInputSchema,
  evaluateRelease,
  type ReleaseEvaluationInput,
} from "@flowmarkdev/core"
import { Effect, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"

export const evaluateReleaseChange = (input: ReleaseEvaluationInput) =>
  Schema.decodeUnknownEffect(ReleaseEvaluationInputSchema)(input).pipe(
    Effect.map(evaluateRelease),
    Effect.mapError(
      () =>
        new InvalidInput({
          cause: "Release evaluation input is outside the supported contract.",
        }),
    ),
  )
