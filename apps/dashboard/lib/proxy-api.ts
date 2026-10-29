import { Data, Effect, Exit, Match } from "effect"
import { dashboardApiUrl } from "./server-env"

class DashboardProxyError extends Data.TaggedError("DashboardProxyError")<{
  readonly cause: unknown
}> {}

const proxyToApi = Effect.fn("proxyToApi")(function* (
  request: Request,
  pathname: string,
) {
  const apiUrl = yield* dashboardApiUrl()
  const incoming = new URL(request.url)
  const endpoint = new URL(
    `${pathname}${incoming.search}`,
    apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`,
  )
  const headers = new Headers()
  for (const name of [
    "cookie",
    "content-type",
    "origin",
    "referer",
    "user-agent",
    "authorization",
    "x-flowmark-project-id",
  ]) {
    const value = request.headers.get(name)
    if (value) {
      headers.set(name, value)
    }
  }
  const protectionBypass = process.env.FLOWMARK_VERCEL_PROTECTION_BYPASS
  if (protectionBypass) {
    headers.set("x-vercel-protection-bypass", protectionBypass)
  }
  const response = yield* Effect.tryPromise({
    try: async () =>
      fetch(endpoint, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await request.text(),
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      }),
    catch: (cause) => new DashboardProxyError({ cause }),
  })
  const forwarded = new Headers()
  for (const cookieValue of response.headers.getSetCookie?.() ?? []) {
    forwarded.append("set-cookie", cookieValue)
  }
  const responseType = response.headers.get("content-type")
  if (responseType) {
    forwarded.set("content-type", responseType)
  }
  forwarded.set("cache-control", "no-store")
  return new Response(response.body, {
    status: response.status,
    headers: forwarded,
  })
})

export async function proxyToApiHandler(request: Request, pathname: string) {
  const result = await Effect.runPromiseExit(proxyToApi(request, pathname))
  return Exit.match(result, {
    onSuccess: (response) => response,
    onFailure: (cause) =>
      Match.value(cause).pipe(
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
