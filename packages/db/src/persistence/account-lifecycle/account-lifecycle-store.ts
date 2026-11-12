import { cancelAccountErasure } from "./writes/cancel-account-erasure.js"
import { Context, Effect, Layer } from "effect"
import {
  Database,
  DatabaseCancellation,
  hashApiKey,
  provideDatabase,
} from "../database.js"
import { consumeAuthRateLimit } from "../auth/writes/consume-auth-rate-limit.js"
import { previewAccountErasure } from "./writes/preview-account-erasure.js"
import { confirmAccountErasure } from "./writes/confirm-account-erasure.js"
import { resumeAccountErasure } from "./writes/resume-account-erasure.js"
import { getAccountErasureStatus } from "./queries/get-account-erasure-status.js"

export class AccountLifecycleStore extends Context.Service<AccountLifecycleStore>()(
  "@flowmark/db/AccountLifecycleStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        cancel: (userId: string, operationId: string) =>
          provide(cancelAccountErasure(userId, operationId)),
        preview: (userId: string) => provide(previewAccountErasure(userId)),
        confirm: (userId: string, operationId: string, confirmation: string) =>
          provide(confirmAccountErasure(userId, operationId, confirmation)),
        resume: (operationId: string, capability: string) =>
          provide(resumeAccountErasure(operationId, capability)),
        status: (operationId: string, capability: string) =>
          provide(getAccountErasureStatus(operationId, capability)),
        capabilityBudget: () =>
          provide(
            consumeAuthRateLimit(
              hashApiKey("flowmark:account-cleanup-service:v1"),
              { window: 60, max: 2000 },
            ),
          ).pipe(Effect.map((budget) => budget.allowed)),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
