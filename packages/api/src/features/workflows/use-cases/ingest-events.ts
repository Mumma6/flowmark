import { Context, Effect, Layer, Schema } from "effect"
import { EventEnvelopeSchema } from "@flowmarkdev/core"
import {
  InvalidInput,
  PersistenceError,
  RunNotFound,
  type Unauthorized,
} from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"

export interface IngestWorkflowEventsService {
  readonly ingest: (
    authorization: string | null,
    input: Effect.Effect<unknown, InvalidInput>,
  ) => Effect.Effect<
    void,
    Unauthorized | InvalidInput | PersistenceError | RunNotFound
  >
}

export class IngestWorkflowEvents extends Context.Tag(
  "@flowmark/api/IngestWorkflowEvents",
)<IngestWorkflowEvents, IngestWorkflowEventsService>() {
  static readonly layer = Layer.effect(
    IngestWorkflowEvents,
    Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const repository = yield* WorkflowRepository

      const ingest = Effect.fn("IngestWorkflowEvents.ingest")(function* (
        header: string | null,
        input: Effect.Effect<unknown, InvalidInput>,
      ) {
        const projectId = yield* authorization.authorize(header, "write")
        const { eventId, event } = yield* input.pipe(
          Effect.flatMap((value) =>
            Schema.decodeUnknown(EventEnvelopeSchema)(value).pipe(
              Effect.mapError((cause) => new InvalidInput({ cause })),
            ),
          ),
        )
        yield* repository.append(projectId, eventId, event)
      })

      return IngestWorkflowEvents.of({ ingest })
    }),
  )
}
