import {
  ObservationRepairInputSchema,
  planObservationRepair,
  type ObservationRepairInput,
  type ObservationRepairPlan,
} from "@flowmarkdev/core"
import { Effect, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"

export const proposeObservationRepair = (
  input: ObservationRepairInput,
): Effect.Effect<ObservationRepairPlan, InvalidInput> =>
  Schema.decodeUnknownEffect(ObservationRepairInputSchema)(input).pipe(
    Effect.map(planObservationRepair),
    Effect.mapError(
      () =>
        new InvalidInput({
          cause: "Observation repair input is outside the supported contract.",
        }),
    ),
  )
