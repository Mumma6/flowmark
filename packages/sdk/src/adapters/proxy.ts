import { HttpClient, HttpClientRequest } from "effect/http"
import { Data, Effect, Exit, Match, Schema, Stream } from "effect"
import { fetchClientLayer } from "../delivery/adapters/fetch-client.js"
import { EventEnvelopeSchema } from "@flowmarkdev/core"
import { resolveSettings } from "../config/settings.js"
import type { FlowmarkConfig } from "../types/index.js"

/** Server-only proxy options. Never pass client-supplied destinations or credentials. */
export interface FlowmarkProxyConfig extends Pick<
  FlowmarkConfig,
  "apiKey" | "apiUrl"
> {
  /**
   * Your session/rate-limit check, run before reading the body.
   * Return false for HTTP 403; errors are logged and produce HTTP 502.
   * Optional for public demos only: Origin validation alone is not authentication or rate limiting.
   */
  readonly authorize?: (request: Request) => boolean | Promise<boolean>
}

class InvalidProxyInput extends Data.TaggedError("InvalidProxyInput")<{
  readonly cause: unknown
}> {}
class ProxyForbidden extends Data.TaggedError("ProxyForbidden") {}
class ProxyAuthorizationError extends Data.TaggedError(
  "ProxyAuthorizationError",
)<{
  readonly cause: unknown
}> {}

const readEnvelope = Effect.fn("Flowmark.Proxy.readEnvelope")(function* (
  request: Request,
) {
  const stream = request.body
  if (Number(request.headers.get("content-length")) > 65536 || !stream) {
    return yield* Effect.fail(
      new InvalidProxyInput({
        cause: "Body is required and must not exceed 64 KiB",
      }),
    )
  }
  const decoder = new TextDecoder()
  const body = yield* Stream.fromReadableStream({
    evaluate: () => stream,
    onError: (cause) => new InvalidProxyInput({ cause }),
    releaseLockOnEnd: true,
  }).pipe(
    Stream.runFoldEffect(
      () => ({ size: 0, text: "" }),
      (state, chunk) => {
        const size = state.size + chunk.byteLength
        return size > 65536
          ? Effect.fail(new InvalidProxyInput({ cause: "Body exceeds 64 KiB" }))
          : Effect.succeed({
              size,
              text: state.text + decoder.decode(chunk, { stream: true }),
            })
      },
    ),
    Effect.ensuring(
      Effect.tryPromise({
        try: () => stream.cancel(),
        catch: (cause) => new InvalidProxyInput({ cause }),
      }).pipe(
        Effect.catch((error) =>
          Effect.logWarning(
            "[Flowmark proxy] Could not cancel request body",
            error,
          ),
        ),
      ),
    ),
  )
  return yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(EventEnvelopeSchema),
  )(body.text + decoder.decode()).pipe(
    Effect.mapError((cause) => new InvalidProxyInput({ cause })),
  )
})

/**
 * Creates a server-only Web Request/Response POST handler for a same-origin browser SDK proxy.
 * Works with Next.js Route Handlers or any backend supporting standard Request/Response.
 * Adds the server's write key, validates events, and limits streamed input to 64 KiB.
 * Requires an Origin matching request.url; register this behind the browser's own origin.
 * Returns 202 after upstream acceptance, 400 for bad input, 403 for denied access,
 * 409/429 for upstream conflict/throttling, or 502 for delivery/configuration failures.
 * @param config Server credentials/API origin (default FLOWMARK_* env) and a production access check.
 * @example
 * import { createFlowmarkProxy } from "@flowmarkdev/node/proxy"
 * export const POST = createFlowmarkProxy({
 *   authorize: async (request) => Boolean(await getSession(request)),
 * })
 */
export function createFlowmarkProxy(config: FlowmarkProxyConfig = {}) {
  return async function POST(request: Request): Promise<Response> {
    const operation = Effect.gen(function* () {
      const origin = new URL(request.url).origin
      if (
        request.method !== "POST" ||
        request.headers.get("origin") !== origin ||
        request.headers.get("sec-fetch-site") === "cross-site"
      ) {
        return yield* Effect.fail(new ProxyForbidden())
      }
      const authorize = config.authorize
      if (authorize) {
        const allowed = yield* Effect.tryPromise({
          try: async () => authorize(request),
          catch: (cause) => new ProxyAuthorizationError({ cause }),
        })
        if (!allowed) {
          return yield* Effect.fail(new ProxyForbidden())
        }
      }
      const envelope = yield* readEnvelope(request)
      const settings = yield* Effect.try(() => resolveSettings(config))
      const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope)
      const upstream = yield* HttpClientRequest.post(
        new URL("/v1/events", settings.apiUrl).toString(),
      ).pipe(
        HttpClientRequest.bearerToken(settings.apiKey),
        HttpClientRequest.bodyJson(envelope),
      )
      const response = yield* Effect.scoped(client.execute(upstream)).pipe(
        Effect.timeout("10 seconds"),
      )
      return Match.value(response.status).pipe(
        Match.when(202, () =>
          Response.json({ accepted: true }, { status: 202 }),
        ),
        Match.when(
          (status) => [400, 409, 429].includes(status),
          (status) =>
            Response.json({ error: "Workflow event rejected." }, { status }),
        ),
        Match.orElse(() => {
          console.error(
            `[Flowmark proxy] Ingestion returned HTTP ${response.status}`,
          )
          return Response.json(
            { error: "Workflow delivery is unavailable." },
            { status: 502 },
          )
        }),
      )
    }).pipe(
      Effect.catchTags({
        ProxyForbidden: () =>
          Effect.succeed(
            Response.json(
              { error: "Workflow proxy access denied." },
              { status: 403 },
            ),
          ),
        InvalidProxyInput: () =>
          Effect.succeed(
            Response.json(
              { error: "Invalid workflow event (maximum 64 KiB)." },
              { status: 400 },
            ),
          ),
      }),
      Effect.provide(fetchClientLayer()),
    )
    const result = await Effect.runPromiseExit(operation, {
      signal: request.signal,
    })
    return Exit.match(result, {
      onSuccess: (response) => response,
      onFailure: (cause) => {
        console.error("[Flowmark proxy] Delivery failed", cause)
        return Response.json(
          { error: "Workflow delivery is unavailable." },
          { status: 502 },
        )
      },
    })
  }
}
