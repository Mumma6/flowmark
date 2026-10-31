import { Effect, Layer } from "effect"
import { DatabaseError, WorkflowStore } from "@flowmark/db/persistence"
import { InvalidInput, PersistenceError, RunNotFound } from "../../../errors.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"

const toPersistenceError = (error: DatabaseError) =>
  new PersistenceError({
    operation: error.operation,
    cause: error.cause,
  })

export const WorkflowRepositoryLive = Layer.effect(
  WorkflowRepository,
  Effect.gen(function* () {
    const store = yield* WorkflowStore
    return WorkflowRepository.of({
      businessInsights: (projectId, query) =>
        store.businessInsights(projectId, query).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: (error) =>
              new InvalidInput({ cause: error.message }),
          }),
        ),
      append: Effect.fn("PostgresWorkflowRepository.append")(
        (projectId, eventId, event) =>
          store.append(projectId, eventId, event).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              MissingRunError: (error) =>
                new RunNotFound({ runId: error.runId }),
            }),
          ),
      ),
      snapshot: Effect.fn("PostgresWorkflowRepository.snapshot")((projectId) =>
        store.snapshot(projectId).pipe(Effect.mapError(toPersistenceError)),
      ),
      listRuns: Effect.fn("PostgresWorkflowRepository.listRuns")(
        (projectId, query) =>
          store.listRuns(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: (error) =>
                new InvalidInput({ cause: error.message }),
            }),
          ),
      ),
      timeline: Effect.fn("PostgresWorkflowRepository.timeline")(
        (projectId, runId) =>
          store
            .timeline(projectId, runId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      related: Effect.fn("PostgresWorkflowRepository.related")(
        (projectId, runId) =>
          store
            .related(projectId, runId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      compare: Effect.fn("PostgresWorkflowRepository.compare")(
        (projectId, runId) =>
          store
            .compare(projectId, runId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      intelligence: Effect.fn("PostgresWorkflowRepository.intelligence")(
        (projectId, query) =>
          store
            .intelligence(projectId, query)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
    })
  }),
)
