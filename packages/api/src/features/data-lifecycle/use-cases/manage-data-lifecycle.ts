import { Context, Effect, Layer, type Redacted } from "effect"
import { ManagementRateLimited, Unauthorized } from "../../../errors.js"
import {
  DataLifecycle,
  LifecycleReauthentication,
} from "../ports/data-lifecycle.js"

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
        const identity = yield* (yield* LifecycleReauthentication).verify(
          password,
        )
        if (
          identity.userId !== userId ||
          !identity.sessionId ||
          identity.verifiedAt > Date.now() ||
          Date.now() - identity.verifiedAt > 300_000
        ) {
          return yield* new Unauthorized({ permission: "write" })
        }
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
