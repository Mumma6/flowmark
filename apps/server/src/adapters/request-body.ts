import { Effect, Schema } from "effect"
import { InvalidInput } from "@flowmark/api"

const maximumBodyBytes = 65536
const JsonSchema = Schema.fromJsonString(Schema.Unknown)

/** Web streams and their resource lifetime belong to the HTTP adapter. */
export const readRawTextBody = Effect.fn("Http.readRawTextBody")(function* (
  request: Request,
) {
  if (Number(request.headers.get("content-length")) > maximumBodyBytes) {
    return yield* Effect.fail(
      new InvalidInput({ cause: "Request body exceeds 64 KiB" }),
    )
  }
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => request.body?.getReader()),
    (reader) =>
      Effect.gen(function* () {
        if (!reader) {
          return yield* Effect.fail(
            new InvalidInput({ cause: "Request body is required" }),
          )
        }
        const decoder = new TextDecoder()
        const readChunk = (
          size: number,
          text: string,
        ): Effect.Effect<string, InvalidInput> =>
          Effect.gen(function* () {
            const { done, value } = yield* Effect.tryPromise({
              try: () => reader.read(),
              catch: (cause) => new InvalidInput({ cause }),
            })
            if (done) {
              return text + decoder.decode()
            }
            const nextSize = size + value.byteLength
            if (nextSize > maximumBodyBytes) {
              return yield* Effect.fail(
                new InvalidInput({ cause: "Request body exceeds 64 KiB" }),
              )
            }
            return yield* readChunk(
              nextSize,
              text + decoder.decode(value, { stream: true }),
            )
          })
        return yield* readChunk(0, "")
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
})

export const readJsonBody = Effect.fn("Http.readJsonBody")(function* (
  request: Request,
) {
  const text = yield* readRawTextBody(request)
  return yield* Schema.decodeUnknownEffect(JsonSchema)(text).pipe(
    Effect.mapError((cause) => new InvalidInput({ cause })),
  )
})
