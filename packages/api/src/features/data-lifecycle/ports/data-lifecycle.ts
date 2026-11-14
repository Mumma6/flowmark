import { Context, type Effect, type Redacted } from "effect"
import type {
  InvalidInput,
  ManagementRateLimited,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"
import type { ErasureOperation, ErasureScope } from "../contracts.js"

export type LifecycleError =
  Unauthorized | InvalidInput | PersistenceError | ManagementRateLimited
export class DataLifecycle extends Context.Service<
  DataLifecycle,
  {
    readonly preview: (
      userId: string,
      projectId: string,
      scope: ErasureScope,
    ) => Effect.Effect<ErasureOperation, LifecycleError>
    readonly status: (
      userId: string,
      projectId: string,
    ) => Effect.Effect<ErasureOperation | null, LifecycleError>
    readonly confirm: (
      userId: string,
      projectId: string,
      operationId: string,
      confirmation: string,
    ) => Effect.Effect<ErasureOperation, LifecycleError>
    readonly cancel: (
      userId: string,
      projectId: string,
      operationId: string,
    ) => Effect.Effect<ErasureOperation, LifecycleError>
    readonly resume: (
      userId: string,
      projectId: string,
      operationId: string,
    ) => Effect.Effect<ErasureOperation, LifecycleError>
    readonly reauthenticationBudget: (
      userId: string,
    ) => Effect.Effect<boolean, PersistenceError>
  }
>()("@flowmark/api/DataLifecycle") {}

/** Request-owned provider identity; the API package never imports auth or HTTP. */
export class LifecycleReauthentication extends Context.Service<
  LifecycleReauthentication,
  {
    readonly verify: (password: Redacted.Redacted<string>) => Effect.Effect<
      {
        readonly userId: string
        readonly sessionId: string
        readonly verifiedAt: number
      },
      Unauthorized | InvalidInput | PersistenceError
    >
  }
>()("@flowmark/api/LifecycleReauthentication") {}
