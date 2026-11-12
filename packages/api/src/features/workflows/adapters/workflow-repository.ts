import {
  PublicReadFailure,
  publicStorageFailure,
} from "../../public-reads/errors.js"
import { Effect, Layer } from "effect"
import { WorkflowStore } from "@flowmark/db/persistence"
import {
  persist,
  toInvalidInput,
  toPersistenceError,
  toRunNotFound,
} from "../../../adapters/persistence-error.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"

export type { WorkflowReadModelContract } from "./read-model-contract.js"

export const WorkflowRepositoryLive = Layer.effect(
  WorkflowRepository,
  Effect.gen(function* () {
    const store = yield* WorkflowStore
    return WorkflowRepository.of({
      linkedComparison: (projectId, query) =>
        store.linkedComparison(projectId, query).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      linkedEvidence: (projectId, query) =>
        store.linkedEvidence(projectId, query).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      referenceJourney: Effect.fn("WorkflowRepositoryLive.referenceJourney")(
        (projectId, query) =>
          store.referenceJourney(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      periodRead: (projectId, input) =>
        store
          .periodRead(projectId, input)
          .pipe(Effect.mapError(publicStorageFailure)),
      runRead: (projectId, input) =>
        store.runRead(projectId, input).pipe(
          Effect.catchTags({
            MissingRunError: () =>
              Effect.fail(new PublicReadFailure({ code: "RUN_NOT_FOUND" })),
            InvalidRunReadCursor: () =>
              Effect.fail(new PublicReadFailure({ code: "INVALID_CURSOR" })),
            DatabaseError: (error) => Effect.fail(publicStorageFailure(error)),
          }),
        ),
      expectations: Effect.fn("WorkflowRepositoryLive.expectations")(
        (projectId, runId) => persist(store.expectations(projectId, runId)),
      ),
      businessInsights: Effect.fn("WorkflowRepositoryLive.businessInsights")(
        (projectId, query) =>
          store.businessInsights(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      append: Effect.fn("WorkflowRepositoryLive.append")(
        (projectId, eventId, event) =>
          store.append(projectId, eventId, event).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              MissingRunError: toRunNotFound,
            }),
          ),
      ),
      snapshot: Effect.fn("WorkflowRepositoryLive.snapshot")((projectId) =>
        persist(store.snapshot(projectId)),
      ),
      workflows: Effect.fn("WorkflowRepositoryLive.workflows")((projectId) =>
        persist(store.workflows(projectId)),
      ),
      listRuns: Effect.fn("WorkflowRepositoryLive.listRuns")(
        (projectId, query) =>
          store.listRuns(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      search: Effect.fn("WorkflowRepositoryLive.search")((projectId, query) =>
        store.search(projectId, query).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
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
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      runInvestigationSummary: Effect.fn(
        "WorkflowRepositoryLive.runInvestigationSummary",
      )((projectId, runId) =>
        store.runInvestigationSummary(projectId, runId).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      ),
      relatedRunsPage: Effect.fn("WorkflowRepositoryLive.relatedRunsPage")(
        (projectId, query) =>
          store.relatedRunsPage(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      expectationsPage: Effect.fn("WorkflowRepositoryLive.expectationsPage")(
        (projectId, query) =>
          store.expectationsPage(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      operationsPage: Effect.fn("WorkflowRepositoryLive.operationsPage")(
        (projectId, query) =>
          store.operationsPage(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      discoverWorkflows: Effect.fn("WorkflowRepositoryLive.discoverWorkflows")(
        (projectId, query) =>
          store.discoverWorkflows(projectId, query).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      discoverWorkflowMeaning: Effect.fn(
        "WorkflowRepositoryLive.discoverWorkflowMeaning",
      )((projectId, query) =>
        store.discoverWorkflowMeaning(projectId, query).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
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
              InvalidResultQuery: toInvalidInput,
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
