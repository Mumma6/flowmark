import { Effect, Layer } from "effect"
import { WorkflowStore } from "@flowmark/db/persistence"
import {
  persist,
  toPersistenceError,
} from "../../../adapters/persistence-error.js"
import { InvalidInput, RunNotFound } from "../../../errors.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"

export type { WorkflowReadModelContract } from "./read-model-contract.js"

export const WorkflowRepositoryLive = Layer.effect(
  WorkflowRepository,
  Effect.gen(function* () {
    const store = yield* WorkflowStore
    return WorkflowRepository.of({
      expectations: Effect.fn("WorkflowRepositoryLive.expectations")(
        (projectId, runId) => persist(store.expectations(projectId, runId)),
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
        persist(store.snapshot(projectId)),
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
      search: Effect.fn("WorkflowRepositoryLive.search")((projectId, query) =>
        store.search(projectId, query).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: (error) =>
              new InvalidInput({ cause: error.message }),
          }),
        ),
      ),
      timeline: Effect.fn("WorkflowRepositoryLive.timeline")(
        (projectId, runId) => persist(store.timeline(projectId, runId)),
      ),
      runEventPage: Effect.fn("WorkflowRepositoryLive.runEventPage")(
        (projectId, query) =>
          store.runEventPage(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: (error) =>
                new InvalidInput({ cause: error.message }),
            }),
          ),
      ),
      runInvestigationSummary: Effect.fn(
        "WorkflowRepositoryLive.runInvestigationSummary",
      )((projectId, runId) =>
        store.runInvestigationSummary(projectId, runId).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: (error) =>
              new InvalidInput({ cause: error.message }),
          }),
        ),
      ),
      related: Effect.fn("WorkflowRepositoryLive.related")((projectId, runId) =>
        persist(store.related(projectId, runId)),
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
        (projectId, query) => persist(store.intelligence(projectId, query)),
      ),
      periodReport: Effect.fn("WorkflowRepositoryLive.periodReport")(
        (projectId, query) => persist(store.periodReport(projectId, query)),
      ),
    })
  }),
)
