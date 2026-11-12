import { Effect, Layer, Match, Redacted } from "effect"
import {
  AccountLifecycleStore,
  type AccountLifecycleOperation,
  type AccountLifecycleRejected,
  type LifecycleRejected,
  type DatabaseError,
} from "@flowmark/db/persistence"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { AccountLifecycle } from "../ports/account-lifecycle.js"
import type { AccountErasureOperation } from "../account-contracts.js"

const messages = {
  InvalidCapability:
    "Cleanup recovery code was not accepted or has expired. Paste a valid code or contact the operator.",
  UnsupportedVersion:
    "Cleanup requires a compatible server version. Contact the operator; access remains locked.",
  SharedProject:
    "Account deletion is blocked by shared ownership. No account or project data has changed.",
  StalePreview:
    "The account preview expired or changed. Review a fresh preview.",
  Unavailable:
    "Finish existing cleanup first, or use your saved cleanup recovery code.",
  ConfirmationRequired: "Enter DELETE MY ACCOUNT exactly to confirm.",
} as const
const rejected = (error: AccountLifecycleRejected | LifecycleRejected) =>
  error.reason === "Unauthorized"
    ? new Unauthorized({ permission: "write" })
    : new InvalidInput({ cause: messages[error.reason] })
const translate = <A, R>(
  operation: Effect.Effect<
    A,
    DatabaseError | AccountLifecycleRejected | LifecycleRejected,
    R
  >,
) =>
  operation.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag("AccountLifecycleRejected", rejected),
        Match.tag("LifecycleRejected", rejected),
        Match.exhaustive,
      ),
    ),
  )
const view = (
  operation: AccountLifecycleOperation,
): AccountErasureOperation => ({
  id: operation.id,
  state: operation.state,
  counts: {
    projects: operation.counts.projects,
    runs: operation.counts.runs,
    events: operation.counts.events,
    apiKeys: operation.counts.apiKeys,
    browserKeys: operation.counts.browserKeys,
    oauthClients: operation.counts.oauthClients,
    delegatedGrants: operation.counts.delegatedGrants,
    previewProjects: operation.counts.previewProjects,
  },
  completedProjects: operation.completedProjects,
  phase: operation.phase,
  failureCode: operation.failureCode,
  expiresAt: operation.expiresAt.toISOString(),
  capabilityExpiresAt: operation.capabilityExpiresAt.toISOString(),
})
export const AccountLifecycleLive = Layer.effect(
  AccountLifecycle,
  Effect.gen(function* () {
    const store = yield* AccountLifecycleStore
    return AccountLifecycle.of({
      cancel: (userId, operationId) =>
        translate(store.cancel(userId, operationId)).pipe(Effect.map(view)),
      preview: (userId) =>
        translate(store.preview(userId)).pipe(
          Effect.map(({ operation, capability }) => ({
            operation: view(operation),
            capability,
          })),
        ),
      confirm: (userId, operationId, confirmation) =>
        translate(store.confirm(userId, operationId, confirmation)).pipe(
          Effect.map(view),
        ),
      status: (operationId, capability) =>
        translate(store.status(operationId, Redacted.value(capability))).pipe(
          Effect.map(view),
        ),
      resume: (operationId, capability) =>
        translate(store.resume(operationId, Redacted.value(capability))).pipe(
          Effect.map(view),
        ),
      capabilityBudget: () =>
        store.capabilityBudget().pipe(Effect.mapError(toPersistenceError)),
    })
  }),
)
