import { HttpClient, HttpClientRequest } from "@effect/platform"
import { Effect, Match, Schedule, type Redacted } from "effect"
import type { WorkflowEvent } from "@flowmarkdev/core"
import { FlowmarkHttpError } from "../../../errors/index.js"
import { WorkflowTransport } from "../ports/workflow-transport.js"

export interface HttpTransportOptions {
  readonly endpoint: string
  readonly apiKey?: Redacted.Redacted<string>
}

export const makeHttpTransport = Effect.fn("Flowmark.HttpTransport.make")(
  function* (settings: HttpTransportOptions) {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
      HttpClient.withScope,
    )

    const emit = Effect.fn("Flowmark.HttpTransport.emit")(function* (
      event: WorkflowEvent,
    ) {
      const eventId = yield* Effect.sync(() => globalThis.crypto.randomUUID())
      // Build once so all retries carry the same idempotency key and payload.
      const baseRequest = HttpClientRequest.post(settings.endpoint)
      const request = yield* (
        settings.apiKey
          ? baseRequest.pipe(HttpClientRequest.bearerToken(settings.apiKey))
          : baseRequest
      ).pipe(
        HttpClientRequest.bodyJson({ eventId, event }),
        Effect.mapError(
          (cause) => new FlowmarkHttpError({ status: undefined, cause }),
        ),
      )
      yield* Effect.scoped(client.execute(request)).pipe(
        Effect.mapError(
          (cause) =>
            new FlowmarkHttpError({
              status: Match.value(cause).pipe(
                Match.tag("ResponseError", ({ response }) => response.status),
                Match.tag("RequestError", () => undefined),
                Match.exhaustive,
              ),
              cause,
            }),
        ),
        Effect.timeoutFail({
          duration: "3 seconds",
          onTimeout: () =>
            new FlowmarkHttpError({
              status: undefined,
              cause: "Ingestion timed out",
            }),
        }),
        Effect.retry({
          schedule: Schedule.exponential("100 millis").pipe(
            Schedule.intersect(Schedule.recurs(2)),
          ),
          while: (error) =>
            error.status === undefined ||
            error.status === 429 ||
            error.status >= 500,
        }),
      )
    })

    return WorkflowTransport.of({ emit })
  },
)
