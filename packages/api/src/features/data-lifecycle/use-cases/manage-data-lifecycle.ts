import { verifyLifecycleIdentity } from "../verify-lifecycle-identity.js"
import { Context, Effect, Layer, type Redacted } from "effect"
import { ManagementRateLimited } from "../../../errors.js"
import { DataLifecycle } from "../ports/data-lifecycle.js"

export class ManageDataLifecycle extends Context.Service<ManageDataLifecycle>()(
  "@flowmark/api/ManageDataLifecycle",
  {
    make: Effect.gen(function* () {
      const lifecycle = yield* DataLifecycle
      const confirm = Effect.fn("ManageDataLifecycle.confirm")(function* (
        userId: string,
        projectId: string,
        operationId: string,
        confirmation: string,
        password: Redacted.Redacted<string>,
      ) {
        if (!(yield* lifecycle.reauthenticationBudget(userId))) {
          return yield* new ManagementRateLimited({ retryAfter: 900 })
        }
        yield* verifyLifecycleIdentity(userId, password)
        return yield* lifecycle.confirm(
          userId,
          projectId,
          operationId,
          confirmation,
        )
      })
      return {
        cancel: lifecycle.cancel,
        preview: lifecycle.preview,
        status: lifecycle.status,
        confirm,
        resume: lifecycle.resume,
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
