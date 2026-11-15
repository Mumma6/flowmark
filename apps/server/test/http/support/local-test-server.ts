import { createServer } from "node:http"
import { Readable } from "node:stream"
import { Data, Effect } from "effect"

export class LocalTestServerError extends Data.TaggedError(
  "LocalTestServerError",
)<{
  readonly cause: unknown
}> {}

/** The listener belongs to the test scope, including assertion failure and interruption. */
export const localTestServer = Effect.fn("test.localTestServer")(function* (
  handler: (request: Request) => Promise<Response> | Response,
) {
  const server = yield* Effect.acquireRelease(
    Effect.sync(() =>
      createServer((incoming, outgoing) => {
        const respond = Effect.tryPromise({
          try: async () => {
            const response = await handler(
              new Request(`http://127.0.0.1${incoming.url}`, {
                method: incoming.method,
                headers: incoming.headers as HeadersInit,
                body:
                  incoming.method === "GET" || incoming.method === "HEAD"
                    ? undefined
                    : (Readable.toWeb(incoming) as ReadableStream<Uint8Array>),
                duplex: "half",
              } as RequestInit),
            )
            outgoing.writeHead(
              response.status,
              Object.fromEntries(response.headers),
            )
            outgoing.end(Buffer.from(await response.arrayBuffer()))
          },
          catch: (cause) => new LocalTestServerError({ cause }),
        }).pipe(
          Effect.catchTag("LocalTestServerError", () =>
            Effect.sync(() => {
              outgoing.destroy()
            }),
          ),
        )
        // Node's incoming-request callback is the HTTP execution boundary.
        void Effect.runPromise(respond)
      }),
    ),
    (server) =>
      Effect.promise(
        () =>
          new Promise<void>((resolve) => {
            server.close(() => resolve())
            server.closeAllConnections()
          }),
      ),
  )
  yield* Effect.callback<void, LocalTestServerError>((resume) => {
    server.once("error", (cause) =>
      resume(Effect.fail(new LocalTestServerError({ cause }))),
    )
    server.listen(0, "127.0.0.1", () => resume(Effect.void))
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    return yield* new LocalTestServerError({ cause: "Missing local test port" })
  }
  return { origin: `http://127.0.0.1:${address.port}` }
})
