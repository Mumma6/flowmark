import { PUBLIC_READ_BOUNDS, RunReadErrorSchema } from "@flowmarkdev/core"
import { Effect, Ref, Schema } from "effect"
import { FlowmarkReadError } from "./error.js"
import { responseJson } from "./read-response.js"

/** A lazy read operation; transport execution and caller cancellation belong to the Promise boundary. */
export const readRequest = <I, O>(
  endpoint: string,
  key: string,
  fetchRead: typeof globalThis.fetch,
  status: Ref.Ref<number | null>,
  kind: "run" | "period",
  input: I,
  inputSchema: Schema.Codec<I>,
  outputSchema: Schema.Codec<O>,
  matches: (output: O, input: I) => boolean,
) => {
  return Effect.scoped(
    Effect.gen(function* () {
      const selection = yield* Schema.decodeUnknownEffect(inputSchema)(input, {
        onExcessProperty: "error",
      }).pipe(Effect.mapError(() => new FlowmarkReadError("INVALID_REQUEST")))
      if (
        typeof key !== "string" ||
        !key.startsWith("fm_read_") ||
        key.length > 249
      ) {
        return yield* Effect.fail(new FlowmarkReadError("UNAUTHORIZED"))
      }
      const body = JSON.stringify(selection)
      if (
        new TextEncoder().encode(body).byteLength >
        PUBLIC_READ_BOUNDS.requestBytes
      ) {
        return yield* Effect.fail(new FlowmarkReadError("REQUEST_TOO_LARGE"))
      }
      const response = yield* Effect.tryPromise({
        try: (signal) =>
          fetchRead(`${endpoint}${kind}`, {
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
            () => new FlowmarkReadError("INVALID_RESPONSE", response.status),
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
      const decoded = yield* Schema.decodeUnknownEffect(outputSchema)(raw).pipe(
        Effect.mapError(
          () => new FlowmarkReadError("INVALID_RESPONSE", response.status),
        ),
      )
      if (!matches(decoded, selection)) {
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
}
