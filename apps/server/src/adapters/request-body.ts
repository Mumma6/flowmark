import { Effect, Schema } from "effect"
import { InvalidInput } from "@flowmark/api"

const maximumBodyBytes = 65536
const JsonSchema = Schema.fromJsonString(Schema.Unknown)

/** Web streams and their resource lifetime belong to the HTTP adapter. */
export const readJsonBody = Effect.fn("Http.readJsonBody")(function* (
  request: Request,
) {
  if (Number(request.headers.get("content-length")) > maximumBodyBytes) {
    return yield* Effect.fail(
      new InvalidInput({ cause: "Request body exceeds 64 KiB" }),
    )
  }
  const text = yield* Effect.acquireUseRelease(
    Effect.sync(() => request.body?.getReader()),
    (reader) =>
      Effect.gen(function* () {
        if (!reader) {
          return yield* Effect.fail(
            new InvalidInput({ cause: "Request body is required" }),
          )
        }
        const decoder = new TextDecoder()
        let size = 0
        let text = ""
        while (true) {
          const { done, value } = yield* Effect.tryPromise({
            try: () => reader.read(),
            catch: (cause) => new InvalidInput({ cause }),
          })
          if (done) {
            return text + decoder.decode()
          }
          size += value.byteLength
          if (size > maximumBodyBytes) {
            return yield* Effect.fail(
              new InvalidInput({ cause: "Request body exceeds 64 KiB" }),
            )
          }
          text += decoder.decode(value, { stream: true })
        }
      }),
    (reader) =>
      reader
        ? Effect.tryPromise({
            try: () => reader.cancel(),
            catch: (cause) => new InvalidInput({ cause }),
          }).pipe(
            Effect.catch((error) =>
              Effect.logWarning(
                "Could not cancel ingestion request body",
                error,
              ),
            ),
            Effect.ensuring(Effect.sync(() => reader.releaseLock())),
          )
        : Effect.void,
  )
  return yield* Schema.decodeUnknownEffect(JsonSchema)(text).pipe(
    Effect.mapError((cause) => new InvalidInput({ cause })),
  )
})
