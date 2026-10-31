import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import {
  isExpectationEvent,
  EXPECTATION_CAPABILITY,
  IngestionReceiptSchema,
} from "@flowmarkdev/core"
import { Effect, Schedule, Schema, Result, type Redacted } from "effect"
import type { WorkflowEvent } from "@flowmarkdev/core"
import { FlowmarkHttpError } from "../../errors/index.js"
import { WorkflowTransport } from "../ports/workflow-transport.js"

export interface HttpTransportOptions {
  readonly expectationProtocol?: boolean
  readonly endpoint: string
  readonly apiKey?: Redacted.Redacted<string>
}

export const makeHttpTransport = Effect.fn("Flowmark.HttpTransport.make")(
  function* (settings: HttpTransportOptions) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope)

    const emit = Effect.fn("Flowmark.HttpTransport.emit")(function* (
      event: WorkflowEvent,
    ) {
      const eventId = yield* Effect.sync(() => globalThis.crypto.randomUUID())
      // Build once so all retries carry the same idempotency key and payload.
      const baseRequest = HttpClientRequest.post(settings.endpoint).pipe(
        HttpClientRequest.setHeaders(
          settings.expectationProtocol && isExpectationEvent(event)
            ? { "x-flowmark-expectations": "v1" }
            : {},
        ),
      )
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
      const capability = isExpectationEvent(event)
        ? EXPECTATION_CAPABILITY
        : requiresAttempts
          ? "attempts-v1"
          : undefined
      yield* Effect.scoped(
        client.execute(request).pipe(
          Effect.mapError(
            (cause) =>
              new FlowmarkHttpError({ status: cause.response?.status, cause }),
          ),
          Effect.flatMap((response) =>
            Effect.gen(function* () {
              if (response.status < 200 || response.status >= 300) {
                const limited =
                  response.status === 429 && isExpectationEvent(event)
                    ? Result.match(yield* Effect.result(response.json), {
                        onFailure: () => false,
                        onSuccess: (body) =>
                          typeof body === "object" &&
                          body !== null &&
                          "code" in body &&
                          body.code === "EXPECTATION_LIMIT_REACHED",
                      })
                    : false
                if (limited) {
                  return yield* new FlowmarkHttpError({
                    status: response.status,
                    cause: "EXPECTATION_LIMIT_REACHED",
                    retryable: false,
                  })
                }
                yield* HttpClientResponse.filterStatusOk(response).pipe(
                  Effect.mapError(
                    (cause) =>
                      new FlowmarkHttpError({ status: response.status, cause }),
                  ),
                )
              }
              return yield* capability !== undefined
                ? response.json.pipe(
                    Effect.flatMap(
                      Schema.decodeUnknownEffect(IngestionReceiptSchema),
                    ),
                    Effect.mapError(
                      (cause) =>
                        new FlowmarkHttpError({
                          status: response.status,
                          cause,
                        }),
                    ),
                    Effect.flatMap((receipt) =>
                      receipt.capabilities?.includes(capability)
                        ? Effect.void
                        : Effect.fail(
                            new FlowmarkHttpError({
                              status: response.status,
                              cause: `Server did not acknowledge ${capability}; upgrade the accepting server before opting in.`,
                            }),
                          ),
                    ),
                  )
                : Effect.void
            }),
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
            error.retryable !== false &&
            (error.status === undefined ||
              error.status === 429 ||
              error.status >= 500),
        }),
      )
    })

    return WorkflowTransport.of({ emit })
  },
)
