import { PUBLIC_READ_BOUNDS } from "@flowmarkdev/core"
import { Effect } from "effect"
import { FlowmarkReadError } from "./error.js"

export const responseJson = Effect.fn("FlowmarkRead.responseJson")(function* (
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
