import { validateHostHeader } from "@modelcontextprotocol/server"
import { Array, Data, Effect, Schema } from "effect"
import type { ResolvedAgentAccessRuntime } from "../runtime/agent-access-runtime.js"

export class McpRequestAuthorityError extends Data.TaggedError(
  "McpRequestAuthorityError",
)<{
  readonly reason: "host" | "origin"
}> {}
const HostAuthority = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) =>
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/",
  ),
)

/** Configured authorities, never Forwarded headers or an incoming URL's claimed origin. */
export const assertMcpRequestAuthority = Effect.fn(
  "Mcp.assertRequestAuthority",
)(function* (
  request: Request,
  runtime: Pick<ResolvedAgentAccessRuntime, "apiOrigin" | "issuerOrigin">,
) {
  const allowedHostnames = [new URL(runtime.apiOrigin).hostname]
  const requestUrl = new URL(request.url)
  const authorities = Array.dedupe([
    requestUrl.host,
    request.headers.get("host") ?? requestUrl.host,
  ])
  yield* Effect.forEach(authorities, (authority) =>
    Schema.decodeUnknownEffect(
      Schema.String.check(Schema.isPattern(/^[^\\/?#@\s]+$/u)),
    )(authority).pipe(
      Effect.andThen(() =>
        Schema.decodeUnknownEffect(HostAuthority)(`http://${authority}`),
      ),
      Effect.mapError(() => new McpRequestAuthorityError({ reason: "host" })),
      Effect.filterOrFail(
        () => validateHostHeader(authority, allowedHostnames).ok,
        () => new McpRequestAuthorityError({ reason: "host" }),
      ),
    ),
  )
  const origin = request.headers.get("origin")
  // Native clients omit Origin. A present browser origin must match scheme and port too.
  if (
    origin !== null &&
    !Array.contains([runtime.apiOrigin, runtime.issuerOrigin], origin)
  ) {
    return yield* new McpRequestAuthorityError({ reason: "origin" })
  }
})
