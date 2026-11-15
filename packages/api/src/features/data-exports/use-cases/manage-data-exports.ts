import { Context, Effect, Layer, type Redacted } from "effect"
import { ManagementRateLimited } from "../../../errors.js"
import { DataLifecycle } from "../../data-lifecycle/ports/data-lifecycle.js"
import { verifyLifecycleIdentity } from "../../data-lifecycle/verify-lifecycle-identity.js"
import { DataExports } from "../ports/data-exports.js"

export class ManageDataExports extends Context.Service<ManageDataExports>()(
  "@flowmark/api/ManageDataExports",
  {
    make: Effect.gen(function* () {
      const exports = yield* DataExports
      const lifecycle = yield* DataLifecycle
      const create = Effect.fn("ManageDataExports.create")(function* (
        userId: string,
        projectId: string | null,
        password: Redacted.Redacted<string>,
      ) {
        if (!(yield* lifecycle.reauthenticationBudget(userId))) {
          return yield* new ManagementRateLimited({ retryAfter: 900 })
        }
        const identity = yield* verifyLifecycleIdentity(userId, password)
        return yield* exports.create(userId, identity.sessionId, projectId)
      })
      const part = Effect.fn("ManageDataExports.part")(function* (
        userId: string,
        sessionId: string,
        id: string,
        cursor: string,
      ) {
        const result = yield* exports.part(userId, sessionId, id, cursor)
        // Delivery is a separate live authority check after materialization.
        yield* exports.check(userId, sessionId, id)
        return result
      })
      return { create, latest: exports.latest, cancel: exports.cancel, part }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
