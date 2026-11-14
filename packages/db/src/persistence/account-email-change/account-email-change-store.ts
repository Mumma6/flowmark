import { Context, Effect, Layer } from "effect"
import { Database, DatabaseCancellation, provideDatabase } from "../database.js"
import {
  getEmailChange,
  getEmailChangeStatus,
} from "./queries/get-email-change.js"
import { withEmailChangeAccount } from "./writes/with-email-change-account.js"
import {
  saveEmailChangeReceipt,
  consumeEmailChangeReceipt,
  pruneEmailChangeRecords,
} from "./writes/email-change-receipt.js"
import type { EmailChangeTransaction, EmailChangeResult } from "./types.js"

export class AccountEmailChangeStore extends Context.Service<AccountEmailChangeStore>()(
  "@flowmark/db/AccountEmailChangeStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        get: (id: string) => provide(getEmailChange(id)),
        status: (userId: string) => provide(getEmailChangeStatus(userId)),
        withAccount: <A, E>(
          userId: string,
          use: (tx: EmailChangeTransaction) => Effect.Effect<A, E>,
        ) => provide(withEmailChangeAccount(userId, use)),
        saveReceipt: (
          hash: string,
          userId: string,
          result: EmailChangeResult,
        ) => provide(saveEmailChangeReceipt(hash, userId, result)),
        consumeReceipt: (hash: string) =>
          provide(consumeEmailChangeReceipt(hash)),
        prune: () => provide(pruneEmailChangeRecords()),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
