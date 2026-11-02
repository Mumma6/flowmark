import { Effect, Layer } from "effect"
import { WorkflowStore } from "@flowmark/db/persistence"
import { toPersistenceError } from "../../../adapters/persistence-error.js"
import { InvalidInput, RunNotFound } from "../../../errors.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"

export type { WorkflowReadModelContract } from "./read-model-contract.js"

export const WorkflowRepositoryLive = Layer.effect(
  WorkflowRepository,
  Effect.gen(function* () {
    const store = yield* WorkflowStore
    return WorkflowRepository.of({
      expectations: Effect.fn("WorkflowRepositoryLive.expectations")(
        (projectId, runId) =>
          store
            .expectations(projectId, runId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      businessInsights: Effect.fn("WorkflowRepositoryLive.businessInsights")(
        (projectId, query) =>
          store.businessInsights(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: (error) =>
                new InvalidInput({ cause: error.message }),
            }),
          ),
      ),
      append: Effect.fn("WorkflowRepositoryLive.append")(
        (projectId, eventId, event) =>
          store.append(projectId, eventId, event).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              MissingRunError: (error) =>
                new RunNotFound({ runId: error.runId }),
            }),
          ),
      ),
      snapshot: Effect.fn("WorkflowRepositoryLive.snapshot")((projectId) =>
        store.snapshot(projectId).pipe(Effect.mapError(toPersistenceError)),
      ),
      workflows: Effect.fn("WorkflowRepositoryLive.workflows")((projectId) =>
        store.workflows(projectId).pipe(Effect.mapError(toPersistenceError)),
      ),
      listRuns: Effect.fn("WorkflowRepositoryLive.listRuns")(
        (projectId, query) =>
          store.listRuns(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: (error) =>
                new InvalidInput({ cause: error.message }),
            }),
          ),
      ),
      timeline: Effect.fn("WorkflowRepositoryLive.timeline")(
        (projectId, runId) =>
          store
            .timeline(projectId, runId)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
      related: Effect.fn("WorkflowRepositoryLive.related")((projectId, runId) =>
        store
          .related(projectId, runId)
          .pipe(Effect.mapError(toPersistenceError)),
      ),
      compare: Effect.fn("WorkflowRepositoryLive.compare")(
        (projectId, runId, selection) =>
          store.compare(projectId, runId, selection).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: (error) =>
                new InvalidInput({ cause: error.message }),
            }),
          ),
      ),
      intelligence: Effect.fn("WorkflowRepositoryLive.intelligence")(
        (projectId, query) =>
          store
            .intelligence(projectId, query)
            .pipe(Effect.mapError(toPersistenceError)),
      ),
    })
  }),
)
