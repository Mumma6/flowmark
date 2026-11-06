import {
  Array as Arr,
  Data,
  Effect,
  Match,
  Option,
  Result,
  Schema,
} from "effect"
import {
  AGENT_ACCESS_CLIENT_POLICY,
  AGENT_ACCESS_DASHBOARD_BROWSER_PATHS,
  AGENT_ACCESS_ISSUER_PROXY_PATHS,
} from "./protocol-constants.js"

export { AGENT_ACCESS_ISSUER_PROXY_PATHS } from "./protocol-constants.js"

export class AgentAccessProxyRedirectError extends Data.TaggedError(
  "AgentAccessProxyRedirectError",
)<{
  readonly reason: "credentials" | "external" | "invalid" | "unbound"
}> {}

const exactIssuerPaths = [
  AGENT_ACCESS_ISSUER_PROXY_PATHS.authorizationServerMetadata,
  AGENT_ACCESS_ISSUER_PROXY_PATHS.openIdConfiguration,
  AGENT_ACCESS_ISSUER_PROXY_PATHS.jwks,
] as const

const oauthIssuerPathname = (issuerPath: string) =>
  issuerPath === AGENT_ACCESS_ISSUER_PROXY_PATHS.oauthPrefix ||
  issuerPath.startsWith(`${AGENT_ACCESS_ISSUER_PROXY_PATHS.oauthPrefix}/`)

const unsafeSegment = (segment: string) =>
  segment.length === 0 || segment === "." || segment === ".."

export const oauthIssuerPath = (
  segments: readonly string[],
): Option.Option<string> =>
  Arr.some(segments, unsafeSegment)
    ? Option.none()
    : Option.some(
        `${AGENT_ACCESS_ISSUER_PROXY_PATHS.oauthPrefix}/${Arr.join(segments, "/")}`,
      )

export const agentAccessUpstreamPath = (
  issuerPath: string,
): Option.Option<string> =>
  Arr.contains(exactIssuerPaths, issuerPath) || oauthIssuerPathname(issuerPath)
    ? Option.some(
        `${AGENT_ACCESS_DASHBOARD_BROWSER_PATHS.existingAuthApiPrefix}${issuerPath}`,
      )
    : Option.none()

const readUrl = (value: string, base?: string | URL) =>
  Effect.try({
    try: () => new URL(value, base),
    catch: () => new AgentAccessProxyRedirectError({ reason: "invalid" }),
  })

const JsonBody = Schema.Record(Schema.String, Schema.Unknown)

const redirectUriFromBody = (
  contentType: string | null,
  body: string | undefined,
) =>
  Match.value(contentType?.split(";")[0]?.trim() ?? "").pipe(
    Match.when("application/x-www-form-urlencoded", () =>
      Option.fromNullishOr(
        body ? new URLSearchParams(body).get("redirect_uri") : null,
      ),
    ),
    Match.when("application/json", () =>
      body
        ? Schema.decodeUnknownResult(Schema.fromJsonString(JsonBody))(
            body,
          ).pipe(
            Result.match({
              onFailure: () => Option.none<string>(),
              onSuccess: (value) =>
                Schema.decodeUnknownResult(Schema.String)(
                  value.redirect_uri,
                ).pipe(
                  Result.match({
                    onFailure: () => Option.none<string>(),
                    onSuccess: Option.some,
                  }),
                ),
            }),
          )
        : Option.none<string>(),
    ),
    Match.orElse(() => Option.none<string>()),
  )

export const redirectUriFromRequest = Effect.fn("AgentAccess.redirectUri")(
  function* (input: {
    readonly requestUrl: string
    readonly contentType: string | null
    readonly body: string | undefined
  }) {
    const request = yield* readUrl(input.requestUrl)
    const query = Option.fromNullishOr(request.searchParams.get("redirect_uri"))
    const bodyUri = redirectUriFromBody(input.contentType, input.body)
    return yield* Option.match(query, {
      onNone: () => Effect.succeed(Option.getOrUndefined(bodyUri)),
      onSome: (queryUri) =>
        Option.match(bodyUri, {
          onNone: () => Effect.succeed<string | undefined>(queryUri),
          onSome: (value) =>
            value === queryUri
              ? Effect.succeed<string | undefined>(queryUri)
              : new AgentAccessProxyRedirectError({ reason: "unbound" }),
        }),
    })
  },
)

const callbackTransport = (url: URL) =>
  Match.value(url.protocol).pipe(
    Match.when("https:", () => Effect.void),
    Match.when("http:", () =>
      Arr.contains(
        AGENT_ACCESS_CLIENT_POLICY.nativeLoopbackRedirectHosts,
        url.hostname,
      )
        ? Effect.void
        : Effect.fail(
            new AgentAccessProxyRedirectError({ reason: "external" }),
          ),
    ),
    Match.orElse(() =>
      Effect.fail(new AgentAccessProxyRedirectError({ reason: "external" })),
    ),
  )

const registeredSearchHeld = (registered: URL, destination: URL) =>
  Arr.every(
    Arr.fromIterable(registered.searchParams.entries()),
    ([key, value]) => destination.searchParams.get(key) === value,
  )

export const decideAuthProxyLocation = Effect.fn(
  "AgentAccess.decideProxyLocation",
)(function* (input: {
  readonly issuerPath: string
  readonly location: string
  readonly requestUrl: string
  readonly redirectUri: string | undefined
}) {
  const request = yield* readUrl(input.requestUrl)
  const destination = yield* readUrl(input.location, request)
  if (destination.username || destination.password) {
    return yield* new AgentAccessProxyRedirectError({ reason: "credentials" })
  }
  if (destination.origin === request.origin) {
    return destination.href
  }
  if (!oauthIssuerPathname(input.issuerPath) || destination.hash) {
    return yield* new AgentAccessProxyRedirectError({ reason: "external" })
  }
  if (!input.redirectUri) {
    return yield* new AgentAccessProxyRedirectError({ reason: "unbound" })
  }
  const registered = yield* readUrl(input.redirectUri)
  yield* callbackTransport(registered)
  if (
    destination.origin !== registered.origin ||
    destination.pathname !== registered.pathname ||
    !registeredSearchHeld(registered, destination)
  ) {
    return yield* new AgentAccessProxyRedirectError({ reason: "unbound" })
  }
  return destination.href
})
