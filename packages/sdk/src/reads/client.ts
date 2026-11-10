import {
  PUBLIC_READ_BOUNDS,
  runReadEvidencePath,
  RunReadInputSchema,
  RunReadResponseSchema,
  RunReadErrorSchema,
  type RunReadInput,
  type RunReadResponse,
} from "@flowmarkdev/core"
import { Cause, Effect, Exit, Ref, Result, Schema } from "effect"
import { FlowmarkReadError } from "./error.js"

export interface FlowmarkReadClient {
  readRun(
    input: RunReadInput,
    options?: { signal?: AbortSignal },
  ): Promise<RunReadResponse>
}

const apiUrl = (base: string) =>
  Effect.try({
    try: () => {
      const url = new URL(base)
      const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
        url.hostname,
      )
      if (
        (url.protocol !== "https:" &&
          !(url.protocol === "http:" && loopback)) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      ) {
        throw new Error("Invalid API URL")
      }
      url.pathname = `${url.pathname.replace(/\/$/, "")}/v1/read/run`
      return url.toString()
    },
    catch: () => new FlowmarkReadError("INVALID_REQUEST"),
  })

const responseJson = Effect.fn("FlowmarkRead.responseJson")(function* (
  response: Response,
) {
  if (
    !response.body ||
    response.headers
      .get("content-type")
      ?.split(";")[0]
      ?.trim()
      .toLowerCase() !== "application/json"
  ) {
    return yield* Effect.fail(
      new FlowmarkReadError("INVALID_RESPONSE", response.status),
    )
  }
  const reader = yield* Effect.acquireRelease(
    Effect.sync(() => response.body!.getReader()),
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
  ): Effect.Effect<string, FlowmarkReadError> =>
    Effect.gen(function* () {
      const chunk = yield* Effect.tryPromise({
        try: () => reader.read(),
        catch: () => new FlowmarkReadError("NETWORK_ERROR", response.status),
      })
      if (chunk.done) {
        return yield* Effect.try({
          try: () => text + decoder.decode(),
          catch: () =>
            new FlowmarkReadError("INVALID_RESPONSE", response.status),
        })
      }
      const next = size + chunk.value.byteLength
      if (next > PUBLIC_READ_BOUNDS.responseBytes) {
        return yield* Effect.fail(
          new FlowmarkReadError("INVALID_RESPONSE", response.status),
        )
      }
      const decoded = yield* Effect.try({
        try: () => decoder.decode(chunk.value, { stream: true }),
        catch: () => new FlowmarkReadError("INVALID_RESPONSE", response.status),
      })
      return yield* collect(next, text + decoded)
    })
  const text = yield* collect(0, "")
  return yield* Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => new FlowmarkReadError("INVALID_RESPONSE", response.status),
  })
})

export const createFlowmarkReadClient = (options: {
  apiBaseUrl: string
  readKey: string
}): FlowmarkReadClient => {
  const endpoint = Result.match(
    Effect.runSync(Effect.result(apiUrl(options.apiBaseUrl))),
    {
      onSuccess: (url) => url,
      onFailure: (error) => {
        throw error
      },
    },
  )
  const key = options.readKey
  // Capture fetch per client rather than relying on a cached Effect reference.
  const fetchRead = globalThis.fetch
  return {
    async readRun(input, requestOptions) {
      const status = Ref.makeUnsafe<number | null>(null)
      const operation = Effect.scoped(
        Effect.gen(function* () {
          const selection = yield* Schema.decodeUnknownEffect(
            RunReadInputSchema,
          )(input, { onExcessProperty: "error" }).pipe(
            Effect.mapError(() => new FlowmarkReadError("INVALID_REQUEST")),
          )
          if (!key.startsWith("fm_read_") || key.length > 249) {
            return yield* Effect.fail(new FlowmarkReadError("UNAUTHORIZED"))
          }
          const body = JSON.stringify(selection)
          if (
            new TextEncoder().encode(body).byteLength >
            PUBLIC_READ_BOUNDS.requestBytes
          ) {
            return yield* Effect.fail(
              new FlowmarkReadError("REQUEST_TOO_LARGE"),
            )
          }
          const response = yield* Effect.tryPromise({
            try: (signal) =>
              fetchRead(endpoint, {
                method: "POST",
                body,
                signal,
                redirect: "error",
                credentials: "omit",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${key}`,
                },
              }),
            catch: () => new FlowmarkReadError("NETWORK_ERROR"),
          })
          yield* Ref.set(status, response.status)
          const raw = yield* responseJson(response)
          if (response.status !== 200) {
            const error = yield* Schema.decodeUnknownEffect(RunReadErrorSchema)(
              raw,
            ).pipe(
              Effect.mapError(
                () =>
                  new FlowmarkReadError("INVALID_RESPONSE", response.status),
              ),
            )
            return yield* Effect.fail(
              new FlowmarkReadError(
                error.error.code,
                response.status,
                error.error.retryAfterSeconds,
              ),
            )
          }
          const decoded = yield* Schema.decodeUnknownEffect(
            RunReadResponseSchema,
          )(raw).pipe(
            Effect.mapError(
              () => new FlowmarkReadError("INVALID_RESPONSE", response.status),
            ),
          )
          if (
            decoded.selection.projectId.toLowerCase() !==
              selection.projectId.toLowerCase() ||
            decoded.selection.runId.toLowerCase() !==
              selection.runId.toLowerCase() ||
            decoded.summary.id.toLowerCase() !==
              selection.runId.toLowerCase() ||
            decoded.selection.limit !== (selection.limit ?? 50) ||
            decoded.evidence.runPath !==
              runReadEvidencePath(decoded.selection) ||
            decoded.selection.cursor !== selection.cursor ||
            decoded.page.limit !== decoded.selection.limit ||
            decoded.page.events.length > decoded.page.limit
          ) {
            return yield* Effect.fail(
              new FlowmarkReadError("INVALID_RESPONSE", response.status),
            )
          }
          return decoded
        }),
      ).pipe(
        Effect.timeoutOrElse({
          duration: PUBLIC_READ_BOUNDS.timeoutMs,
          orElse: () =>
            Ref.get(status).pipe(
              Effect.flatMap((httpStatus) =>
                Effect.fail(new FlowmarkReadError("READ_TIMEOUT", httpStatus)),
              ),
            ),
        }),
      )
      const result = await Effect.runPromiseExit(operation, {
        signal: requestOptions?.signal,
      })
      return Exit.match(result, {
        onSuccess: (value) => value,
        onFailure: (cause) => {
          if (requestOptions?.signal?.aborted) {
            throw new FlowmarkReadError("ABORTED", Ref.getUnsafe(status))
          }
          const reason = cause.reasons[0]
          if (
            cause.reasons.length === 1 &&
            reason &&
            Cause.isFailReason(reason)
          ) {
            throw reason.error
          }
          throw new FlowmarkReadError("NETWORK_ERROR", Ref.getUnsafe(status))
        },
      })
    },
  }
}
