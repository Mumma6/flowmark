import { ProjectCredentialsStore } from "@flowmark/db/persistence"
import { Effect, Layer } from "effect"
import { PublicReadAdmission } from "../ports/public-read-admission.js"
import { PublicReadFailure, publicStorageFailure } from "../errors.js"

export const PublicReadAdmissionLive = Layer.effect(
  PublicReadAdmission,
  Effect.gen(function* () {
    const store = yield* ProjectCredentialsStore
    return PublicReadAdmission.of({
      consume: Effect.fn("PublicReadAdmission.consume")(
        function* (scope, maximum) {
          const result = yield* store
            .consumePublicReadBudget(scope, maximum)
            .pipe(Effect.mapError(publicStorageFailure))
          if (!result.allowed) {
            return yield* new PublicReadFailure({
              code: "RATE_LIMITED",
              retryAfterSeconds: result.retryAfter ?? 60,
            })
          }
        },
      ),
    })
  }),
)
