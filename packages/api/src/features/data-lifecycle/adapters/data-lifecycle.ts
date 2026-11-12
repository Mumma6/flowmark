import { Effect, Layer, Match } from "effect"
import {
  DataLifecycleStore,
  type LifecycleOperation,
  type LifecycleRejected,
  type DatabaseError,
} from "@flowmark/db/persistence"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { DataLifecycle } from "../ports/data-lifecycle.js"
import type { ErasureOperation } from "../contracts.js"

const messages = {
  UnsupportedVersion:
    "Cleanup requires a compatible server version. Contact the operator; access remains locked.",
  SharedProject:
    "Deletion is unavailable for shared projects until ownership and transfer are supported.",
  StalePreview:
    "The preview expired or changed. Review a fresh preview before confirming.",
  Unavailable:
    "Project cleanup is already in progress. Open its status to resume.",
  ConfirmationRequired: "Enter the exact project name to confirm.",
} as const
const rejected = (error: LifecycleRejected) =>
  error.reason === "Unauthorized"
    ? new Unauthorized({ permission: "write" })
    : new InvalidInput({ cause: messages[error.reason] })
const operationView = (operation: LifecycleOperation): ErasureOperation => ({
  id: operation.id,
  projectId: operation.projectId,
  projectName: operation.projectName,
  scope: operation.scope,
  counts: {
    runs: operation.counts.runs,
    events: operation.counts.events,
    apiKeys: operation.counts.apiKeys,
    browserKeys: operation.counts.browserKeys,
    configurations: operation.counts.configurations,
    latestStart: operation.counts.latestStart,
  },
  state: operation.state,
  phase: operation.phase,
  deletedEvents: operation.deletedEvents,
  deletedRuns: operation.deletedRuns,
  failureCode: operation.failureCode,
  expiresAt: operation.expiresAt.toISOString(),
})
const translate = <A, R>(
  effect: Effect.Effect<A, DatabaseError | LifecycleRejected, R>,
) =>
  effect.pipe(
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("DatabaseError", toPersistenceError),
        Match.tag("LifecycleRejected", rejected),
        Match.exhaustive,
      ),
    ),
  )
export const DataLifecycleLive = Layer.effect(
  DataLifecycle,
  Effect.gen(function* () {
    const store = yield* DataLifecycleStore
    return DataLifecycle.of({
      preview: (userId, projectId, scope) =>
        translate(store.preview(userId, projectId, scope)).pipe(
          Effect.map(operationView),
        ),
      confirm: (userId, projectId, operationId, confirmation) =>
        translate(
          store.confirm(userId, projectId, operationId, confirmation),
        ).pipe(Effect.map(operationView)),
      cancel: (userId, projectId, operationId) =>
        translate(store.cancel(userId, projectId, operationId)).pipe(
          Effect.map(operationView),
        ),
      resume: (userId, projectId, operationId) =>
        translate(store.resume(userId, projectId, operationId)).pipe(
          Effect.map(operationView),
        ),
      status: (userId, projectId) =>
        translate(store.status(userId, projectId)).pipe(
          Effect.map((operation) =>
            operation ? operationView(operation) : null,
          ),
        ),
      reauthenticationBudget: (userId) =>
        store
          .reauthenticationBudget(userId)
          .pipe(Effect.mapError(toPersistenceError)),
    })
  }),
)
