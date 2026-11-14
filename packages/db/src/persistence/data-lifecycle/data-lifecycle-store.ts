import { cancelErasure } from "./writes/cancel-erasure.js"
import { pruneLifecycleRecords } from "./writes/prune-lifecycle-records.js"
import { createHash } from "node:crypto"
import { consumeAuthRateLimit } from "../auth/writes/consume-auth-rate-limit.js"
import { Context, Effect, Layer } from "effect"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import { getErasureStatus } from "./queries/get-erasure-status.js"
import { previewErasure } from "./writes/preview-erasure.js"
import { confirmErasure } from "./writes/confirm-erasure.js"
import { resumeErasure } from "./writes/resume-erasure.js"
import type { ErasureScope } from "./types.js"

export class DataLifecycleStore extends Context.Service<DataLifecycleStore>()(
  "@flowmark/db/DataLifecycleStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        cancel: (userId: string, projectId: string, operationId: string) =>
          provide(cancelErasure(userId, projectId, operationId)),
        reauthenticationBudget: (userId: string) =>
          provide(
            consumeAuthRateLimit(
              createHash("sha256")
                .update(`flowmark:lifecycle-reauth:v1:${userId}`)
                .digest("hex"),
              { window: 900, max: 5 },
            ),
          ).pipe(Effect.map((budget) => budget.allowed)),
        preview: (userId: string, projectId: string, scope: ErasureScope) =>
          provide(
            pruneLifecycleRecords().pipe(
              Effect.andThen(previewErasure(userId, projectId, scope)),
            ),
          ),
        confirm: (
          userId: string,
          projectId: string,
          operationId: string,
          confirmation: string,
        ) =>
          provide(confirmErasure(userId, projectId, operationId, confirmation)),
        resume: (userId: string, projectId: string, operationId: string) =>
          provide(resumeErasure(userId, projectId, operationId)),
        status: (userId: string, projectId: string) =>
          provide(getErasureStatus(userId, projectId)),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
