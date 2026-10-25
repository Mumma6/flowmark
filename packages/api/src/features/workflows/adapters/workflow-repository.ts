import { Effect, Layer } from "effect"
import {
  appendEvent,
  Database,
  DatabaseError,
  MissingRunError as DbMissingRunError,
  readRelatedRuns,
  readRun,
  readSnapshot,
} from "@flowmark/db/store"
import { PersistenceError, RunNotFound } from "../../../errors.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"

const mapDatabaseError = (error: DatabaseError) =>
  new PersistenceError({
    operation: error.operation,
    cause: error.cause,
  })

export const WorkflowRepositoryLive = Layer.effect(
  WorkflowRepository,
  Effect.gen(function* () {
    const db = yield* Database
    return WorkflowRepository.of({
      append: Effect.fn("PostgresWorkflowRepository.append")(
        (projectId, eventId, event) =>
          appendEvent(projectId, eventId, event).pipe(
            Effect.provideService(Database, db),
            Effect.mapError((error) =>
              error instanceof DbMissingRunError
                ? new RunNotFound({ runId: error.runId })
                : mapDatabaseError(error),
            ),
          ),
      ),
      snapshot: Effect.fn("PostgresWorkflowRepository.snapshot")((projectId) =>
        readSnapshot(projectId).pipe(
          Effect.provideService(Database, db),
          Effect.mapError(mapDatabaseError),
        ),
      ),
      timeline: Effect.fn("PostgresWorkflowRepository.timeline")(
        (projectId, runId) =>
          readRun(projectId, runId).pipe(
            Effect.provideService(Database, db),
            Effect.mapError(mapDatabaseError),
          ),
      ),
      related: Effect.fn("PostgresWorkflowRepository.related")(
        (projectId, runId) =>
          readRelatedRuns(projectId, runId).pipe(
            Effect.provideService(Database, db),
            Effect.mapError(mapDatabaseError),
          ),
      ),
    })
  }),
)
