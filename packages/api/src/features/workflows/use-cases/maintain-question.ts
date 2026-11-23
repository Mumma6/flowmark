import {
  QuestionMaintenanceInputSchema,
  maintainQuestion,
  type QuestionMaintenanceInput,
} from "@flowmarkdev/core"
import { Effect, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"

export const maintainQuestionRepair = (input: QuestionMaintenanceInput) =>
  Schema.decodeUnknownEffect(QuestionMaintenanceInputSchema)(input).pipe(
    Effect.map(maintainQuestion),
    Effect.mapError(
      () =>
        new InvalidInput({
          cause:
            "Question maintenance input is outside the supported contract.",
        }),
    ),
  )
