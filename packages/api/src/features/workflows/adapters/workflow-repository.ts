import { withReadSubject } from "./with-read-subject.js"
import { InvalidInput } from "../../../errors.js"
import {
  PublicReadFailure,
  publicStorageFailure,
} from "../../public-reads/errors.js"
import { Effect, Layer, Option, Redacted } from "effect"
import { WorkflowStore, hashApiKey } from "@flowmark/db/persistence"
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
        withReadSubject(store.linkedComparison(projectId, query)).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      linkedEvidence: (projectId, query) =>
        withReadSubject(store.linkedEvidence(projectId, query)).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      referenceJourney: Effect.fn("WorkflowRepositoryLive.referenceJourney")(
        (projectId, query) =>
          withReadSubject(store.referenceJourney(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      periodRead: (projectId, input) =>
        withReadSubject(store.periodRead(projectId, input)).pipe(
          Effect.mapError(publicStorageFailure),
        ),
      runRead: (projectId, input) =>
        withReadSubject(store.runRead(projectId, input)).pipe(
          Effect.catchTags({
            MissingRunError: () =>
              Effect.fail(new PublicReadFailure({ code: "RUN_NOT_FOUND" })),
            InvalidRunReadCursor: () =>
              Effect.fail(new PublicReadFailure({ code: "INVALID_CURSOR" })),
            DatabaseError: (error) => Effect.fail(publicStorageFailure(error)),
          }),
        ),
      expectations: Effect.fn("WorkflowRepositoryLive.expectations")(
        (projectId, runId) =>
          persist(withReadSubject(store.expectations(projectId, runId))),
      ),
      businessInsights: Effect.fn("WorkflowRepositoryLive.businessInsights")(
        (projectId, query) =>
          withReadSubject(store.businessInsights(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      append: Effect.fn("WorkflowRepositoryLive.append")(
        (projectId, eventId, event, credential) =>
          store
            .append(
              projectId,
              eventId,
              event,
              Option.fromUndefinedOr(credential).pipe(
                Option.map(({ kind, key }) => ({
                  kind,
                  keyHash: hashApiKey(Redacted.value(key)),
                })),
                Option.getOrUndefined,
              ),
            )
            .pipe(
              Effect.catchTags({
                DatabaseError: toPersistenceError,
                MissingRunError: toRunNotFound,
                IngestionRejected: (error) =>
                  Effect.fail(
                    new InvalidInput({
                      cause:
                        error.reason === "HistoricalStart"
                          ? "New run starts must be later than the project erasure boundary."
                          : "Project or ingestion credential is no longer available.",
                    }),
                  ),
              }),
            ),
      ),
      snapshot: Effect.fn("WorkflowRepositoryLive.snapshot")((projectId) =>
        persist(withReadSubject(store.snapshot(projectId))),
      ),
      workflows: Effect.fn("WorkflowRepositoryLive.workflows")((projectId) =>
        persist(withReadSubject(store.workflows(projectId))),
      ),
      listRuns: Effect.fn("WorkflowRepositoryLive.listRuns")(
        (projectId, query) =>
          withReadSubject(store.listRuns(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      search: Effect.fn("WorkflowRepositoryLive.search")((projectId, query) =>
        withReadSubject(store.search(projectId, query)).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      ),
      timeline: Effect.fn("WorkflowRepositoryLive.timeline")(
        (projectId, runId) =>
          persist(withReadSubject(store.timeline(projectId, runId))),
      ),
      runEventPage: Effect.fn("WorkflowRepositoryLive.runEventPage")(
        (projectId, query) =>
          withReadSubject(store.runEventPage(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      runInvestigationSummary: Effect.fn(
        "WorkflowRepositoryLive.runInvestigationSummary",
      )((projectId, runId) =>
        withReadSubject(store.runInvestigationSummary(projectId, runId)).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      ),
      relatedRunsPage: Effect.fn("WorkflowRepositoryLive.relatedRunsPage")(
        (projectId, query) =>
          withReadSubject(store.relatedRunsPage(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      expectationsPage: Effect.fn("WorkflowRepositoryLive.expectationsPage")(
        (projectId, query) =>
          withReadSubject(store.expectationsPage(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      operationsPage: Effect.fn("WorkflowRepositoryLive.operationsPage")(
        (projectId, query) =>
          withReadSubject(store.operationsPage(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      discoverWorkflows: Effect.fn("WorkflowRepositoryLive.discoverWorkflows")(
        (projectId, query) =>
          withReadSubject(store.discoverWorkflows(projectId, query)).pipe(
            Effect.catchTags({
              DatabaseError: toPersistenceError,
              InvalidResultQuery: toInvalidInput,
            }),
          ),
      ),
      discoverWorkflowMeaning: Effect.fn(
        "WorkflowRepositoryLive.discoverWorkflowMeaning",
      )((projectId, query) =>
        withReadSubject(store.discoverWorkflowMeaning(projectId, query)).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      ),
      related: Effect.fn("WorkflowRepositoryLive.related")((projectId, runId) =>
        persist(withReadSubject(store.related(projectId, runId))),
      ),
      comparisonEvidence: Effect.fn(
        "WorkflowRepositoryLive.comparisonEvidence",
      )((projectId, runId, selection) =>
        withReadSubject(
          store.comparisonEvidence(projectId, runId, selection),
        ).pipe(
          Effect.catchTags({
            DatabaseError: toPersistenceError,
            InvalidResultQuery: toInvalidInput,
          }),
        ),
      ),
      intelligence: Effect.fn("WorkflowRepositoryLive.intelligence")(
        (projectId, query) =>
          persist(withReadSubject(store.intelligence(projectId, query))),
      ),
      periodReport: Effect.fn("WorkflowRepositoryLive.periodReport")(
        (projectId, query) =>
          persist(withReadSubject(store.periodReport(projectId, query))),
      ),
    })
  }),
)
