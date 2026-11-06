import { Array as Arr } from "effect"
import {
  AUTH_PROXY_IDENTITY_HEADER,
  signAuthProxyIdentity,
} from "@flowmark/auth/client-identity"
import {
  agentAccessUpstreamPath,
  decideAuthProxyLocation,
  redirectUriFromRequest,
} from "@flowmark/auth/agent-access/proxy-route"
import { Data, Effect, Exit, Match, Option } from "effect"
import "server-only"
import { runDashboardServerExit } from "./server-runtime"
import { DashboardApi } from "./api-server-client"

class DashboardProxyError extends Data.TaggedError("DashboardProxyError")<{
  readonly cause: unknown
}> {}

const proxyToApi = Effect.fn("proxyToApi")(function* (
  request: Request,
  pathname: string,
  issuerPath = pathname,
) {
  const api = yield* DashboardApi
  const incoming = new URL(request.url)
  const headers = new Headers()
  Arr.forEach(
    Arr.fromIterable([
      "cookie",
      "content-type",
      "origin",
      "referer",
      "user-agent",
      "sec-fetch-site",
      "authorization",
      "x-flowmark-project-id",
    ]),
    (name) => {
      const value = request.headers.get(name)
      if (value) {
        headers.set(name, value)
      }
    },
  )
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
  const redirectUri = yield* redirectUriFromRequest({
    requestUrl: request.url,
    contentType: request.headers.get("content-type"),
    body,
  }).pipe(Effect.mapError((cause) => new DashboardProxyError({ cause })))
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
  Arr.forEach(
    Arr.fromIterable(response.headers.getSetCookie?.() ?? []),
    (cookieValue) => {
      forwarded.append("set-cookie", cookieValue)
    },
  )
  const location = response.headers.get("location")
  if (location && pathname.startsWith("/api/auth/")) {
    const destination = yield* decideAuthProxyLocation({
      issuerPath,
      location,
      requestUrl: incoming.href,
      redirectUri,
    }).pipe(
      Effect.mapError(
        () =>
          new DashboardProxyError({
            cause: new Error("Untrusted auth redirect"),
          }),
      ),
    )
    forwarded.set("location", destination)
  }
  forwarded.set("referrer-policy", "no-referrer")
  const responseType = response.headers.get("content-type")
  if (responseType) {
    forwarded.set("content-type", responseType)
  }
  Arr.forEach(
    Arr.fromIterable(["retry-after", "x-retry-after", "www-authenticate"]),
    (name) => {
      const value = response.headers.get(name)
      if (value) {
        forwarded.set(name, value)
      }
    },
  )
  forwarded.set("cache-control", "no-store")
  return new Response(response.body, {
    status: response.status,
    headers: forwarded,
  })
})

export async function proxyToApiHandler(
  request: Request,
  pathname: string,
  options?: { readonly issuerPath?: string },
) {
  const result = await runDashboardServerExit(
    proxyToApi(request, pathname, options?.issuerPath),
  )
  const response = Exit.match(result, {
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
  const headers = new Headers(response.headers)
  headers.set("cache-control", "no-store")
  headers.set("referrer-policy", "no-referrer")
  return new Response(response.body, { status: response.status, headers })
}

export function proxyIssuerPath(request: Request, issuerPath: string) {
  return Option.match(agentAccessUpstreamPath(issuerPath), {
    onNone: () =>
      Promise.resolve(
        new Response(null, {
          status: 404,
          headers: { "cache-control": "no-store" },
        }),
      ),
    onSome: (pathname) => proxyToApiHandler(request, pathname, { issuerPath }),
  })
}
