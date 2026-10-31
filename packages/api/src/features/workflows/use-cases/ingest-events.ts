import { isExpectationEvent } from "@flowmarkdev/core"
import { ExpectationSourceForbidden } from "../../../errors.js"
import { Context, Effect, Layer, Schema } from "effect"
import { type AppendDisposition, EventEnvelopeSchema } from "@flowmarkdev/core"
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
    expectationProtocol?: boolean,
  ) => Effect.Effect<
    AppendDisposition,
    | Unauthorized
    | InvalidInput
    | PersistenceError
    | RunNotFound
    | ExpectationSourceForbidden
  >
}
export class IngestWorkflowEvents extends Context.Service<
  IngestWorkflowEvents,
  IngestWorkflowEventsService
>()("@flowmark/api/IngestWorkflowEvents") {
  static readonly layer = Layer.effect(
    IngestWorkflowEvents,
    Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const repository = yield* WorkflowRepository

      const ingest = Effect.fn("IngestWorkflowEvents.ingest")(function* (
        header: string | null,
        input: Effect.Effect<unknown, InvalidInput>,
        expectationProtocol = false,
      ) {
        const projectId = yield* authorization.authorize(header, "write")
        const { eventId, event } = yield* input.pipe(
          Effect.flatMap((value) =>
            Schema.decodeUnknownEffect(EventEnvelopeSchema)(value).pipe(
              Effect.mapError((cause) => new InvalidInput({ cause })),
            ),
          ),
        )
        if (isExpectationEvent(event) && !expectationProtocol) {
          return yield* new ExpectationSourceForbidden()
        }
        return yield* repository.append(projectId, eventId, event)
      })

      return IngestWorkflowEvents.of({ ingest })
    }),
  )
}
