import { Array, Effect, Ref } from "effect"
import {
  AuthorizeProject,
  IngestWorkflowEvents,
  ManageResultDeclarations,
} from "@flowmark/api"
import { Database, ExpectationObservationClock } from "@flowmark/db/persistence"
import {
  DatasetConflict,
  FixtureEventTransaction,
  findFixtureAccount,
  findFixtureProjects,
  inspectDataset,
  resetDataset,
  withDatasetTransaction,
} from "@flowmark/db/fixtures"
import type { FlowmarkDatabase } from "@flowmark/db"
import {
  DATASET,
  ACCOUNT_EMAIL,
  PROJECT_NAME,
  resultDeclaration,
  searchFields,
  workflowNames,
} from "../scenarios/catalog.js"
import type { Dataset } from "../generator/generate.js"
import { canonical } from "../generator/identity.js"
import { fixtureApi } from "../runtime.js"

export type DatasetOperation = "seed" | "reset" | "reseed" | "status"

export const operateDataset = Effect.fn("Meridian.operateDataset")(function* (
  db: FlowmarkDatabase,
  input: {
    readonly projectId: string
    readonly key: string
    readonly dataset: Dataset
    readonly operation: DatasetOperation
    readonly onProgress?: (runs: number, total: number) => Effect.Effect<void>
  },
) {
  return yield* withDatasetTransaction(db, input.projectId, (transaction) =>
    Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const project = yield* authorization.authorize(
        `Bearer ${input.key}`,
        "write",
      )
      if (project !== input.projectId) {
        return yield* new DatasetConflict({
          reason: "The write key belongs to another project.",
        })
      }
      const account = yield* findFixtureAccount(ACCOUNT_EMAIL)
      const owned = account
        ? yield* findFixtureProjects(account.id, PROJECT_NAME)
        : []
      if (!account || !owned.some((item) => item.id === project)) {
        return yield* new DatasetConflict({
          reason:
            "Expected the Meridian Health account to own this dedicated project.",
        })
      }
      const before = yield* inspectDataset(project, input.dataset)
      if (input.operation === "status") {
        return {
          dataset: DATASET,
          runs: before.runs,
          events: before.events,
          complete: before.complete,
        }
      }
      if (input.operation === "seed" && before.complete) {
        return {
          dataset: DATASET,
          runs: before.runs,
          events: before.events,
          complete: true,
        }
      }
      if (input.operation === "reset" || input.operation === "reseed") {
        yield* resetDataset(project, input.dataset)
      }
      if (input.operation === "reset") {
        return { dataset: DATASET, runs: 0, events: 0, complete: false }
      }
      const configuration = yield* ManageResultDeclarations
      yield* Effect.forEach(workflowNames, (workflow) =>
        Effect.gen(function* () {
          const declaration = resultDeclaration(workflow)
          const existing = yield* configuration.list(
            account.id,
            project,
            workflow,
          )
          const same = existing.find(
            (item) => item.revision === declaration.revision,
          )
          if (same && canonical(same) !== canonical(declaration)) {
            return yield* new DatasetConflict({
              reason:
                "Existing result declaration differs; configuration was preserved.",
            })
          }
          if (!same) {
            yield* configuration.create(
              account.id,
              project,
              workflow,
              declaration,
            )
          }
          const fields = yield* configuration.searchFields(
            account.id,
            project,
            workflow,
          )
          if (fields.length && canonical(fields) !== canonical(searchFields)) {
            return yield* new DatasetConflict({
              reason:
                "Existing search settings differ; configuration was preserved.",
            })
          }
          if (!fields.length) {
            yield* configuration.setSearchFields(
              account.id,
              project,
              workflow,
              searchFields,
            )
          }
        }),
      )
      const ingestion = yield* IngestWorkflowEvents
      const completed = yield* Ref.make(0)
      const deliver = (run: Dataset["runs"][number]) =>
        Effect.forEach(
          run.events,
          (envelope) =>
            ingestion
              .ingest(`Bearer ${input.key}`, Effect.succeed(envelope), true)
              .pipe(
                // Only this CLI fixture composition can simulate observation of a historical confirmation.
                Effect.provideService(ExpectationObservationClock, {
                  now: () => Effect.succeed(new Date(envelope.event.timestamp)),
                }),
                Effect.flatMap((disposition) =>
                  disposition === "recorded" || disposition === "duplicate"
                    ? Effect.void
                    : new DatasetConflict({
                        reason: `Fixture event rejected (${disposition}); the transaction was rolled back.`,
                      }),
                ),
              ),
          { concurrency: 1 },
        ).pipe(
          Effect.tap(() =>
            Ref.updateAndGet(completed, (count) => count + 1).pipe(
              Effect.flatMap((count) =>
                input.onProgress &&
                (count % 250 === 0 || count === input.dataset.runs.length)
                  ? input.onProgress(count, input.dataset.runs.length)
                  : Effect.void,
              ),
            ),
          ),
        )
      // Drain each bounded batch so a cold prepared query cannot keep the
      // driver's transaction queue serial for the entire historical population.
      yield* Effect.forEach(
        Array.chunksOf(input.dataset.runs, 16),
        (batch) => Effect.forEach(batch, deliver, { concurrency: 16 }),
        { concurrency: 1 },
      )
      const after = yield* inspectDataset(project, input.dataset)
      if (!after.complete) {
        return yield* new DatasetConflict({
          reason:
            "Incomplete fixture after ingestion; the transaction was rolled back.",
        })
      }
      return {
        dataset: DATASET,
        runs: after.runs,
        events: after.events,
        complete: after.complete,
      }
    }).pipe(
      Effect.provide(fixtureApi(transaction)),
      Effect.provideService(Database, transaction),
      Effect.provideService(FixtureEventTransaction, transaction),
    ),
  )
})
