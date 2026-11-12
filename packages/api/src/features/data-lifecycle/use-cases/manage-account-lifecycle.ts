import { verifyLifecycleIdentity } from "../verify-lifecycle-identity.js"
import { Context, Effect, Layer, type Redacted } from "effect"
import { ManagementRateLimited } from "../../../errors.js"
import { DataLifecycle } from "../ports/data-lifecycle.js"
import { AccountLifecycle } from "../ports/account-lifecycle.js"

export class ManageAccountLifecycle extends Context.Service<ManageAccountLifecycle>()(
  "@flowmark/api/ManageAccountLifecycle",
  {
    make: Effect.gen(function* () {
      const accounts = yield* AccountLifecycle
      const projects = yield* DataLifecycle
      const confirm = Effect.fn("ManageAccountLifecycle.confirm")(function* (
        userId: string,
        operationId: string,
        confirmation: string,
        password: Redacted.Redacted<string>,
      ) {
        if (!(yield* projects.reauthenticationBudget(userId))) {
          return yield* new ManagementRateLimited({ retryAfter: 900 })
        }
        yield* verifyLifecycleIdentity(userId, password)
        return yield* accounts.confirm(userId, operationId, confirmation)
      })
      const requireCapabilityBudget = Effect.fn(
        "ManageAccountLifecycle.requireCapabilityBudget",
      )(function* () {
        if (!(yield* accounts.capabilityBudget())) {
          return yield* new ManagementRateLimited({ retryAfter: 60 })
        }
      })
      return {
        cancel: accounts.cancel,
        preview: accounts.preview,
        confirm,
        status: Effect.fn("ManageAccountLifecycle.status")(function* (
          operationId: string,
          capability: Redacted.Redacted<string>,
        ) {
          yield* requireCapabilityBudget()
          return yield* accounts.status(operationId, capability)
        }),
        resume: Effect.fn("ManageAccountLifecycle.resume")(function* (
          operationId: string,
          capability: Redacted.Redacted<string>,
        ) {
          yield* requireCapabilityBudget()
          return yield* accounts.resume(operationId, capability)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
