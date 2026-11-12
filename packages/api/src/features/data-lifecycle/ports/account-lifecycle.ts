import { Context, type Effect, type Redacted } from "effect"
import type { PersistenceError } from "../../../errors.js"
import type { AccountErasureOperation } from "../account-contracts.js"
import type { LifecycleError } from "./data-lifecycle.js"

export class AccountLifecycle extends Context.Service<
  AccountLifecycle,
  {
    readonly cancel: (
      userId: string,
      operationId: string,
    ) => Effect.Effect<AccountErasureOperation, LifecycleError>
    readonly preview: (userId: string) => Effect.Effect<
      {
        readonly operation: AccountErasureOperation
        readonly capability: string
      },
      LifecycleError
    >
    readonly confirm: (
      userId: string,
      operationId: string,
      confirmation: string,
    ) => Effect.Effect<AccountErasureOperation, LifecycleError>
    readonly status: (
      operationId: string,
      capability: Redacted.Redacted<string>,
    ) => Effect.Effect<AccountErasureOperation, LifecycleError>
    readonly resume: (
      operationId: string,
      capability: Redacted.Redacted<string>,
    ) => Effect.Effect<AccountErasureOperation, LifecycleError>
    readonly capabilityBudget: () => Effect.Effect<boolean, PersistenceError>
  }
>()("@flowmark/api/AccountLifecycle") {}
