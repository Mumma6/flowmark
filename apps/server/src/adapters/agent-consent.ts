import {
  AgentConsent,
  InvalidInput,
  PersistenceError,
  Unauthorized,
  runApi,
} from "@flowmark/api"
import { readAuthSecret } from "@flowmark/auth"
import {
  agentConsentAccountBinding,
  hashOAuthToken,
  verifyAgentConsentAccountBinding,
  verifyAgentConsentRequest,
} from "@flowmark/auth/agent-access"
import { Effect, Exit, Match, Option, Schema } from "effect"
import { getAuth } from "../auth"
import {
  resolveAgentAccessRuntime,
  type ResolvedAgentAccessRuntime,
} from "../agent-access-runtime"
import { serverOrigins } from "../server-env"
import { readJsonBody } from "./request-body"

const ConsentSubmission = Schema.Struct({
  oauthQuery: Schema.String.check(Schema.isMaxLength(8192)),
  accountBinding: Schema.String.check(Schema.isMaxLength(128)),
  accept: Schema.Boolean,
  projectIds: Schema.Array(
    Schema.String.check(Schema.isPattern(/^[0-9a-f-]{36}$/i)),
  ).check(Schema.isMaxLength(10)),
})
const ProviderResult = Schema.Struct({
  redirect: Schema.Boolean,
  url: Schema.String,
})
const unavailable = (cause: unknown) => new InvalidInput({ cause })

const consentRequest = Effect.fn("AgentConsentHttp.request")(function* (
  request: Request,
  runtime: ResolvedAgentAccessRuntime,
) {
  const auth = yield* getAuth()
  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers: request.headers }),
    catch: unavailable,
  })
  if (!session) {
    return yield* new Unauthorized({ permission: "read" })
  }
  const secret = yield* readAuthSecret()
  const submission =
    request.method === "POST"
      ? yield* readJsonBody(request).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(ConsentSubmission)),
          Effect.mapError(unavailable),
        )
      : undefined
  const oauthQuery =
    submission?.oauthQuery ??
    new URL(request.url).searchParams.get("oauth_query") ??
    ""
  const signed = yield* verifyAgentConsentRequest(
    oauthQuery,
    secret,
    runtime.mcpResourceUrl,
  )
  const consent = yield* AgentConsent
  const prepared = yield* consent.prepare(
    session.user.id,
    signed.clientId,
    signed.redirectUri,
  )
  if (!submission) {
    return Response.json({
      ...prepared,
      account: { id: session.user.id, email: session.user.email },
      scopes: signed.scopes,
      accountBinding: agentConsentAccountBinding(
        oauthQuery,
        session.user.id,
        session.session.id,
        secret,
      ),
    })
  }
  const origins = yield* serverOrigins()
  if (
    request.headers.get("origin") !== origins.dashboardOrigin ||
    !verifyAgentConsentAccountBinding(
      submission.accountBinding,
      oauthQuery,
      session.user.id,
      session.session.id,
      secret,
    )
  ) {
    return yield* new InvalidInput({
      cause:
        "The account or authorization form changed. Reload before continuing.",
    })
  }
  if (
    submission.accept &&
    (!submission.projectIds.length ||
      !submission.projectIds.every((id) =>
        prepared.projects.some((project) => project.id === id),
      ))
  ) {
    return yield* new InvalidInput({
      cause: "Select projects available to the current account.",
    })
  }
  const headers = new Headers(request.headers)
  headers.set("content-type", "application/json")
  const provider = yield* Effect.tryPromise({
    try: () =>
      auth.handler(
        new Request(`${runtime.apiOrigin}/api/auth/oauth2/consent`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            accept: submission.accept,
            oauth_query: oauthQuery,
          }),
        }),
      ),
    catch: unavailable,
  })
  if (provider.status >= 500) {
    return yield* new PersistenceError({
      operation: "agent-consent-provider",
      cause: "provider unavailable",
    })
  }
  if (!provider.ok) {
    return yield* new InvalidInput({
      cause:
        "The provider could not accept this request. Restart authorization from your client.",
    })
  }
  const result = yield* Effect.tryPromise({
    try: () => provider.json(),
    catch: unavailable,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(ProviderResult)),
    Effect.mapError(unavailable),
  )
  const callback = yield* Schema.decodeUnknownEffect(Schema.URLFromString)(
    result.url,
  ).pipe(Effect.mapError(unavailable))
  const expected = new URL(signed.redirectUri)
  if (
    callback.origin !== expected.origin ||
    callback.pathname !== expected.pathname
  ) {
    return yield* new InvalidInput({
      cause:
        "The provider returned a different callback. Restart authorization.",
    })
  }
  if (submission.accept) {
    const code = callback.searchParams.get("code")
    if (!code) {
      return yield* new InvalidInput({
        cause:
          "The provider did not issue an authorization code. Restart authorization.",
      })
    }
    yield* consent.bindCode({
      userId: session.user.id,
      sessionId: session.session.id,
      clientId: signed.clientId,
      resourceUrl: runtime.mcpResourceUrl,
      redirectUri: signed.redirectUri,
      authorizationCodeId: hashOAuthToken(code),
      projectIds: submission.projectIds,
    })
  }
  return Response.json({ redirect: result.url })
})

export const handleAgentConsent = async (request: Request) => {
  const runtime = await Effect.runPromiseExit(resolveAgentAccessRuntime(), {
    signal: request.signal,
  })
  if (Exit.isFailure(runtime) || Option.isNone(runtime.value)) {
    return Response.json(
      {
        message: Exit.isFailure(runtime)
          ? "Authorization is temporarily unavailable."
          : "Agent access is not enabled here.",
      },
      {
        status: Exit.isFailure(runtime) ? 503 : 404,
        headers: {
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        },
      },
    )
  }
  const exit = await runApi(
    consentRequest(request, runtime.value.value),
    request.signal,
  )
  const response = Exit.match(exit, {
    onSuccess: (value) => value,
    onFailure: (cause) => {
      const reason = cause.reasons.length === 1 ? cause.reasons[0] : undefined
      return Match.value(reason).pipe(
        Match.tag("Fail", ({ error }) =>
          Match.value(error).pipe(
            Match.tag("Unauthorized", () =>
              Response.json(
                { message: "Sign in to review this authorization." },
                { status: 401 },
              ),
            ),
            Match.tag("InvalidInput", () =>
              Response.json(
                {
                  message:
                    "This authorization form is invalid or stale. Reload it or restart from your client.",
                },
                { status: 400 },
              ),
            ),
            Match.tag("AgentAccessContractError", (error) =>
              Response.json({ message: error.reason }, { status: 400 }),
            ),
            Match.orElse(() =>
              Response.json(
                {
                  message:
                    "Authorization is temporarily unavailable. Please retry.",
                },
                { status: 503 },
              ),
            ),
          ),
        ),
        Match.orElse(() =>
          Response.json(
            {
              message:
                "Authorization is temporarily unavailable. Please retry.",
            },
            { status: 503 },
          ),
        ),
      )
    },
  })
  const headers = new Headers(response.headers)
  headers.set("cache-control", "no-store")
  headers.set("referrer-policy", "no-referrer")
  return new Response(response.body, { status: response.status, headers })
}
