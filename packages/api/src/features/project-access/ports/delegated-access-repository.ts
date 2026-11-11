import { Context, type Effect } from "effect"
import type { PersistenceError } from "../../../errors.js"

export interface GrantFamilySelection {
  readonly subjectUserId: string
  readonly clientId: string
  readonly authorizationCodeId: string
  readonly resource: string
}
export interface DelegatedConnectionSelection {
  readonly userId: string
  readonly clientId: string
  readonly authorizationCodeId: string
}
export interface DelegatedConnectionRecord extends DelegatedConnectionSelection {
  readonly clientName: string | null
  readonly projects: readonly { readonly id: string; readonly name: string }[]
}
export type AdmissionDecision = {
  readonly allowed: boolean
  readonly retryAfter: number | null
}

/** Active delegated authority and its durable admission, independent of OAuth/SQL adapters. */
export class DelegatedAccessRepository extends Context.Service<
  DelegatedAccessRepository,
  {
    readonly grantFamily: (
      input: GrantFamilySelection,
    ) => Effect.Effect<string | undefined, PersistenceError>
    readonly connection: (
      input: DelegatedConnectionSelection,
    ) => Effect.Effect<
      Omit<DelegatedConnectionRecord, "userId"> | undefined,
      PersistenceError
    >
    readonly recordAuthenticated: (
      input: DelegatedConnectionSelection & { readonly at: Date },
    ) => Effect.Effect<void, PersistenceError>
    readonly consumeBudget: (
      scope: string,
      maximum: number,
    ) => Effect.Effect<AdmissionDecision, PersistenceError>
  }
>()("@flowmark/api/DelegatedAccessRepository") {}
