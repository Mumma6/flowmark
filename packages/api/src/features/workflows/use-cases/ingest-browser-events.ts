import { Context, Effect, Layer, Redacted, Schema } from "effect"
import { DEMO_BROWSER_KEY, DIAGNOSTICS_BROWSER_KEY } from "@flowmark/db/demo"
import { EventEnvelopeSchema } from "@flowmark/core"
import { ApiSettings } from "../../../config.js"
import {
  BrowserForbidden,
  BrowserRateLimited,
  BrowserUnauthorized,
  InvalidInput,
  PersistenceError,
  RunNotFound,
} from "../../../errors.js"
import { ProjectCredentials } from "../../project-access/ports/project-credentials.js"
import { WorkflowRepository } from "../ports/workflow-repository.js"

export interface IngestBrowserWorkflowEventsService {
  readonly originAllowed: (
    origin: string,
  ) => Effect.Effect<boolean, PersistenceError>
  readonly ingest: (
    header: string | null,
    origin: string | null,
    input: Effect.Effect<unknown, InvalidInput>,
  ) => Effect.Effect<
    void,
    | BrowserUnauthorized
    | BrowserForbidden
    | BrowserRateLimited
    | InvalidInput
    | PersistenceError
    | RunNotFound
  >
}

export class IngestBrowserWorkflowEvents extends Context.Tag(
  "@flowmark/api/IngestBrowserWorkflowEvents",
)<IngestBrowserWorkflowEvents, IngestBrowserWorkflowEventsService>() {
  static readonly layer = Layer.effect(
    IngestBrowserWorkflowEvents,
    Effect.gen(function* () {
      const repository = yield* WorkflowRepository
      const credentials = yield* ProjectCredentials
      const settings = yield* ApiSettings
      const ingest = Effect.fn("IngestBrowserWorkflowEvents.ingest")(function* (
        header: string | null,
        origin: string | null,
        input: Effect.Effect<unknown, InvalidInput>,
      ) {
        if (!header?.startsWith("Bearer ")) {
          return yield* Effect.fail(new BrowserUnauthorized())
        }
        const key = header.slice(7)
        if (
          (key === DEMO_BROWSER_KEY || key === DIAGNOSTICS_BROWSER_KEY) &&
          !settings.demoMode
        ) {
          return yield* Effect.fail(new BrowserUnauthorized())
        }
        const credential = yield* credentials.authenticateBrowser(
          Redacted.make(key),
        )
        if (!credential) {
          return yield* Effect.fail(new BrowserUnauthorized())
        }
        if (!origin || !credential.allowedOrigins.includes(origin)) {
          return yield* Effect.fail(new BrowserForbidden())
        }
        const allowed = yield* credentials.consumeBrowserQuota(credential.id)
        if (!allowed) {
          return yield* Effect.fail(new BrowserRateLimited())
        }
        const envelope = yield* input.pipe(
          Effect.flatMap((value) =>
            Schema.decodeUnknown(EventEnvelopeSchema)(value).pipe(
              Effect.mapError((cause) => new InvalidInput({ cause })),
            ),
          ),
        )
        const event = envelope.event
        yield* repository.append(credential.projectId, envelope.eventId, {
          ...event,
          workflow: event.workflow.startsWith("browser.")
            ? event.workflow
            : `browser.${event.workflow}`,
        })
      })
      return IngestBrowserWorkflowEvents.of({
        ingest,
        originAllowed: credentials.browserOriginAllowed,
      })
    }),
  )
}
