import {
  AUTH_PROXY_IDENTITY_HEADER,
  signAuthProxyIdentity,
} from "@flowmark/auth/client-identity"
import { Data, Effect, Exit, Match } from "effect"
import "server-only"
import { runDashboardServerExit } from "../server-runtime"
import { DashboardApi } from "./server-client"

class DashboardProxyError extends Data.TaggedError("DashboardProxyError")<{
  readonly cause: unknown
}> {}

const proxyToApi = Effect.fn("proxyToApi")(function* (
  request: Request,
  pathname: string,
) {
  const api = yield* DashboardApi
  const incoming = new URL(request.url)
  const headers = new Headers()
  for (const name of [
    "cookie",
    "content-type",
    "origin",
    "referer",
    "user-agent",
    "sec-fetch-site",
    "authorization",
    "x-flowmark-project-id",
  ]) {
    const value = request.headers.get(name)
    if (value) {
      headers.set(name, value)
    }
  }
  if (pathname === "/api/register" || pathname.startsWith("/api/auth/")) {
    const identity = yield* signAuthProxyIdentity(request, pathname)
    if (identity) {
      headers.set(AUTH_PROXY_IDENTITY_HEADER, identity)
    }
  }
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : yield* Effect.tryPromise({
          try: () => request.text(),
          catch: (cause) => new DashboardProxyError({ cause }),
        })
  const response = yield* api
    .request(
      `${pathname}${incoming.search}`,
      {
        method: request.method,
        headers,
        body,
        signal: request.signal,
      },
      15000,
    )
    .pipe(Effect.mapError((cause) => new DashboardProxyError({ cause })))
  const forwarded = new Headers()
  for (const cookieValue of response.headers.getSetCookie?.() ?? []) {
    forwarded.append("set-cookie", cookieValue)
  }
  const responseType = response.headers.get("content-type")
  if (responseType) {
    forwarded.set("content-type", responseType)
  }
  for (const name of ["retry-after", "x-retry-after"]) {
    const value = response.headers.get(name)
    if (value) {
      forwarded.set(name, value)
    }
  }
  forwarded.set("cache-control", "no-store")
  return new Response(response.body, {
    status: response.status,
    headers: forwarded,
  })
})

export async function proxyToApiHandler(request: Request, pathname: string) {
  const result = await runDashboardServerExit(proxyToApi(request, pathname))
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: (cause) =>
      Match.value(
        cause.reasons.length === 1 ? cause.reasons[0] : undefined,
      ).pipe(
        Match.tag("Fail", ({ error }) =>
          Match.value(error).pipe(
            Match.tag("DashboardConfigurationError", (error) =>
              Response.json({ error: error.reason }, { status: 500 }),
            ),
            Match.orElse(() => {
              console.error("[Flowmark dashboard] API request failed", {
                type: "DashboardProxyError",
              })
              return Response.json(
                { error: "Flowmark API is unavailable." },
                { status: 502 },
              )
            }),
          ),
        ),
        Match.orElse(() =>
          Response.json(
            { error: "Flowmark API is unavailable." },
            { status: 502 },
          ),
        ),
      ),
  })
}
