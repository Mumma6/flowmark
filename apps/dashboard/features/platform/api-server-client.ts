import { Context, Data, Effect, Layer } from "effect"
import "server-only"
import { DashboardServerConfig } from "./config-server"

export class DashboardRequestError extends Data.TaggedError(
  "DashboardRequestError",
)<{
  readonly operation: string
  readonly cause: unknown
}> {}

/** The upstream boundary preserves HTTP statuses; callers own response policy. */
export class DashboardApi extends Context.Service<
  DashboardApi,
  {
    readonly request: (
      path: string,
      options: RequestInit,
      timeoutMs: number,
    ) => Effect.Effect<Response, DashboardRequestError>
  }
>()("@flowmark/dashboard/DashboardApi") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const config = yield* DashboardServerConfig
      return DashboardApi.of({
        request: Effect.fn("DashboardApi.request")(
          function* (path, options, timeoutMs) {
            const headers = new Headers(options.headers)
            if (config.protectionBypass) {
              headers.set("x-vercel-protection-bypass", config.protectionBypass)
            }
            return yield* Effect.tryPromise({
              try: (signal) =>
                fetch(new URL(path, config.apiUrl), {
                  ...options,
                  headers,
                  cache: "no-store",
                  redirect: "manual",
                  signal: AbortSignal.any([
                    signal,
                    AbortSignal.timeout(timeoutMs),
                    ...(options.signal ? [options.signal] : []),
                  ]),
                }),
              catch: (cause) =>
                new DashboardRequestError({
                  operation: path.split("?")[0]!,
                  cause,
                }),
            })
          },
        ),
      })
    }),
  )
}
