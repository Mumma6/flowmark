import { HttpClient, HttpClientRequest } from "effect/http"
import { IngestionReceiptSchema } from "@flowmarkdev/core"
import { Effect, Schedule, Schema, type Redacted } from "effect"
import type { WorkflowEvent } from "@flowmarkdev/core"
import { FlowmarkHttpError } from "../../errors/index.js"
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
      const requiresAttempts =
        ("attempt" in event && event.attempt !== undefined) ||
        (event.type === "started" && event.retryOf !== undefined)
      yield* Effect.scoped(
        client.execute(request).pipe(
          Effect.mapError(
            (cause) =>
              new FlowmarkHttpError({ status: cause.response?.status, cause }),
          ),
          Effect.flatMap((response) =>
            requiresAttempts
              ? response.json.pipe(
                  Effect.flatMap(
                    Schema.decodeUnknownEffect(IngestionReceiptSchema),
                  ),
                  Effect.mapError(
                    (cause) =>
                      new FlowmarkHttpError({ status: response.status, cause }),
                  ),
                  Effect.flatMap((receipt) =>
                    receipt.capabilities?.includes("attempts-v1")
                      ? Effect.void
                      : Effect.fail(
                          new FlowmarkHttpError({
                            status: response.status,
                            cause:
                              "Server did not acknowledge attempts-v1; upgrade the accepting server before opting in.",
                          }),
                        ),
                  ),
                )
              : Effect.void,
          ),
        ),
      ).pipe(
        Effect.timeoutOrElse({
          duration: "3 seconds",
          orElse: () =>
            Effect.fail(
              new FlowmarkHttpError({
                status: undefined,
                cause: "Ingestion timed out",
              }),
            ),
        }),
        Effect.retry({
          schedule: Schedule.exponential("100 millis"),
          times: 2,
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
