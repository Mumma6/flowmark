import { Layer } from "effect"
import { FetchHttpClient } from "effect/http"

/** Capture fetch at the client boundary, independently of v4 Reference defaults. */
export function fetchClientLayer(options: RequestInit = {}) {
  return FetchHttpClient.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(FetchHttpClient.Fetch, globalThis.fetch),
        Layer.succeed(FetchHttpClient.RequestInit, options),
      ),
    ),
  )
}
