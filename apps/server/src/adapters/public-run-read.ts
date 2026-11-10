import { ApiLive, PublicReadFailure, ReadPublicRun } from "@flowmark/api"
import { DatabaseReadBudget } from "@flowmark/db/persistence"
import { PUBLIC_READ_BOUNDS, type RunReadError } from "@flowmark/api"
import { Effect, Exit, type Layer } from "effect"

const statuses = {
  INVALID_REQUEST: 400,
  UNSUPPORTED_VERSION: 400,
  UNSUPPORTED_SELECTION: 400,
  INVALID_CURSOR: 400,
  UNAUTHORIZED: 401,
  PROJECT_FORBIDDEN: 403,
  RUN_NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  EVIDENCE_TOO_LARGE: 422,
  RATE_LIMITED: 429,
  READ_UNAVAILABLE: 503,
  READ_TIMEOUT: 504,
} as const

const messages: Record<keyof typeof statuses, string> = {
  INVALID_REQUEST: "Invalid read request.",
  UNSUPPORTED_VERSION: "Unsupported read version.",
  UNSUPPORTED_SELECTION:
    "This selection is not supported by the run-events read.",
  INVALID_CURSOR:
    "Invalid or expired cursor. Explicitly restart the selection.",
  UNAUTHORIZED: "A valid project read key is required.",
  PROJECT_FORBIDDEN: "The read key does not authorize this project.",
  RUN_NOT_FOUND: "Run not found in this project.",
  METHOD_NOT_ALLOWED: "Use POST.",
  REQUEST_TOO_LARGE: "The request exceeds the byte limit.",
  UNSUPPORTED_MEDIA_TYPE: "Use application/json.",
  EVIDENCE_TOO_LARGE:
    "Evidence exceeds the response budget. Request fewer events.",
  RATE_LIMITED: "Read budget exhausted. Retry after the indicated delay.",
  READ_UNAVAILABLE: "The read is unavailable.",
  READ_TIMEOUT: "The read deadline was exceeded.",
}

const failureResponse = (failure: PublicReadFailure) => {
  const body: RunReadError = {
    version: 1,
    error: {
      code: failure.code,
      message: messages[failure.code],
      retryAfterSeconds: failure.retryAfterSeconds ?? null,
    },
  }
  return Response.json(body, {
    status: statuses[failure.code],
    headers: {
      "Cache-Control": "no-store",
      ...(failure.code === "RATE_LIMITED"
        ? { "Retry-After": String(failure.retryAfterSeconds ?? 60) }
        : {}),
      ...(failure.code === "METHOD_NOT_ALLOWED" ? { Allow: "POST" } : {}),
      ...(failure.code === "UNAUTHORIZED"
        ? { "WWW-Authenticate": 'Bearer realm="flowmark-read"' }
        : {}),
    },
  })
}

const requestJson = Effect.fn("PublicRunRead.requestJson")(function* (
  request: Request,
) {
  if (!request.body) {
    return yield* new PublicReadFailure({ code: "INVALID_REQUEST" })
  }
  const reader = yield* Effect.acquireRelease(
    Effect.sync(() => request.body!.getReader()),
    (reader) =>
      Effect.promise(() => reader.cancel()).pipe(
        Effect.ignore,
        Effect.andThen(Effect.sync(() => reader.releaseLock())),
      ),
  )
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const collect = (
    size: number,
    text: string,
  ): Effect.Effect<string, PublicReadFailure> =>
    Effect.gen(function* () {
      const chunk = yield* Effect.tryPromise({
        try: () => reader.read(),
        catch: () => new PublicReadFailure({ code: "INVALID_REQUEST" }),
      })
      if (chunk.done) {
        return yield* Effect.try({
          try: () => text + decoder.decode(),
          catch: () => new PublicReadFailure({ code: "INVALID_REQUEST" }),
        })
      }
      const next = size + chunk.value.byteLength
      if (next > PUBLIC_READ_BOUNDS.requestBytes) {
        return yield* new PublicReadFailure({ code: "REQUEST_TOO_LARGE" })
      }
      const decoded = yield* Effect.try({
        try: () => decoder.decode(chunk.value, { stream: true }),
        catch: () => new PublicReadFailure({ code: "INVALID_REQUEST" }),
      })
      return yield* collect(next, text + decoded)
    })
  const text = yield* collect(0, "")
  return yield* Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => new PublicReadFailure({ code: "INVALID_REQUEST" }),
  })
})

const operation = (request: Request) =>
  Effect.scoped(
    Effect.gen(function* () {
      if (request.method !== "POST") {
        return yield* new PublicReadFailure({ code: "METHOD_NOT_ALLOWED" })
      }
      if (
        request.headers
          .get("content-type")
          ?.split(";")[0]
          ?.trim()
          .toLowerCase() !== "application/json"
      ) {
        return yield* new PublicReadFailure({ code: "UNSUPPORTED_MEDIA_TYPE" })
      }
      const raw = yield* requestJson(request)
      const read = yield* ReadPublicRun
      const response = yield* read.read(
        request.headers.get("authorization"),
        raw,
      )
      const json = JSON.stringify(response)
      if (
        new TextEncoder().encode(json).byteLength >
        PUBLIC_READ_BOUNDS.responseBytes
      ) {
        return yield* new PublicReadFailure({ code: "EVIDENCE_TOO_LARGE" })
      }
      return new Response(json, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      })
    }),
  )

/** Injectable request boundary; tests exercise the same adapter with real HTTP. */
export const handlePublicRunRead = async (
  request: Request,
  layer: Layer.Layer<ReadPublicRun, unknown> = ApiLive,
) => {
  const result = await Effect.runPromiseExit(
    operation(request).pipe(
      Effect.catchTag("PublicReadFailure", (error) =>
        Effect.succeed(failureResponse(error)),
      ),
      Effect.provide(layer),
      Effect.mapError(
        () => new PublicReadFailure({ code: "READ_UNAVAILABLE" }),
      ),
      Effect.provideService(DatabaseReadBudget, {
        statementTimeoutMs: PUBLIC_READ_BOUNDS.statementTimeoutMs,
      }),
      Effect.timeoutOrElse({
        duration: PUBLIC_READ_BOUNDS.timeoutMs,
        orElse: () =>
          Effect.fail(new PublicReadFailure({ code: "READ_TIMEOUT" })),
      }),
      Effect.catchTag("PublicReadFailure", (error) =>
        Effect.succeed(failureResponse(error)),
      ),
    ),
    { signal: request.signal },
  )
  if (request.signal.aborted) {
    throw request.signal.reason
  }
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: () =>
      failureResponse(new PublicReadFailure({ code: "READ_UNAVAILABLE" })),
  })
}
