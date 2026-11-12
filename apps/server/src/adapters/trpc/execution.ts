import { TRPCError } from "@trpc/server"
import { Effect, Exit, Match, Option, Schema } from "effect"
import {
  AgentAccess,
  ManageInvestigations,
  ManageResultDeclarations,
  ConfigurationError,
  GetProjectWorkflowData,
  type ProjectReader,
  InvalidInput,
  ManageProject,
  ManagementRateLimited,
  Onboarding,
  PersistenceError,
  logFailure,
  runApi,
  Unauthorized,
} from "@flowmark/api"
import { getAuth } from "../../auth"
import { UuidSchema } from "./schemas"
const sessionUserId = Effect.fn("sessionUserId")(function* (request: Request) {
  if (!request.headers.get("cookie") || !process.env.DATABASE_URL) {
    return Option.none<string>()
  }
  const auth = yield* getAuth()
  const session = yield* Effect.tryPromise({
    try: () =>
      auth.api.getSession({
        headers: request.headers,
      }),
    catch: (cause) =>
      new PersistenceError({ operation: "auth-session", cause }),
  })
  return Option.fromNullishOr(session?.user.id)
})

function requestedProjectId(request: Request) {
  const value = request.headers.get("x-flowmark-project-id")?.trim()
  return value && Schema.is(UuidSchema)(value) ? value : undefined
}

function requestedGrantClientId(request: Request) {
  const value = request.headers.get("x-flowmark-grant-client-id")?.trim()
  return value && value.length > 0 ? value : undefined
}

function requestedGrantAuthorizationCodeId(request: Request) {
  const value = request.headers
    .get("x-flowmark-grant-authorization-code-id")
    ?.trim()
  return value && value.length > 0 ? value : undefined
}

async function executeQuery<A>(
  request: Request,
  operation: Effect.Effect<
    A,
    | Unauthorized
    | PersistenceError
    | ConfigurationError
    | InvalidInput
    | ManagementRateLimited,
    | ManageInvestigations
    | AgentAccess
    | GetProjectWorkflowData
    | ManageProject
    | Onboarding
    | ManageResultDeclarations
  >,
) {
  const result = await runApi(
    operation.pipe(
      Effect.catchTag("Unauthorized", () =>
        Effect.fail(
          new TRPCError({
            code: "UNAUTHORIZED",
            message: "Sign in required.",
          }),
        ),
      ),
      Effect.catchTag("InvalidInput", (error) =>
        Effect.fail(
          new TRPCError({
            code: "BAD_REQUEST",
            message:
              typeof error.cause === "string"
                ? error.cause
                : "Invalid request.",
          }),
        ),
      ),
      Effect.catchTag("ManagementRateLimited", (error) =>
        Effect.fail(
          new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Creation limit reached. Try again in ${error.retryAfter} seconds.`,
          }),
        ),
      ),
    ),
    request.signal,
  )
  const internalError = () => {
    logFailure(result)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Could not read workflow data. Check API database configuration.",
    })
  }
  return Exit.match(result, {
    onSuccess: (value) => value,
    onFailure: (cause) =>
      Match.value(
        cause.reasons.length === 1 ? cause.reasons[0] : undefined,
      ).pipe(
        Match.tag("Fail", ({ error }) =>
          Match.value(error).pipe(
            Match.when(Match.instanceOf(TRPCError), (error) => {
              throw error
            }),
            Match.orElse(internalError),
          ),
        ),
        Match.orElse(internalError),
      ),
  })
}

export function readQuery<A>(
  request: Request,
  read: (
    reader: ProjectReader,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError | InvalidInput | ManagementRateLimited,
    GetProjectWorkflowData
  >,
) {
  const projectId = requestedProjectId(request)
  const grantClientId = requestedGrantClientId(request)
  const grantAuthorizationCodeId = requestedGrantAuthorizationCodeId(request)
  const grantHeaderCount =
    (grantClientId ? 1 : 0) + (grantAuthorizationCodeId ? 1 : 0)
  return executeQuery(
    request,
    Effect.gen(function* () {
      if (grantHeaderCount === 1) {
        return yield* Effect.fail(new Unauthorized({ permission: "read" }))
      }
      if (grantHeaderCount === 2) {
        if (!projectId || !grantClientId || !grantAuthorizationCodeId) {
          return yield* Effect.fail(new Unauthorized({ permission: "read" }))
        }
        const userId = yield* sessionUserId(request).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(new Unauthorized({ permission: "read" })),
              onSome: Effect.succeed,
            }),
          ),
        )
        return yield* read({
          _tag: "DelegatedUser",
          userId,
          clientId: grantClientId,
          authorizationCodeId: grantAuthorizationCodeId,
          projectId,
        })
      }
      return yield* sessionUserId(request).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              read({
                _tag: "Key",
                header: request.headers.get("authorization"),
              }),
            onSome: (userId) => read({ _tag: "User", userId, projectId }),
          }),
        ),
      )
    }),
  )
}

export function sessionQuery<A>(
  request: Request,
  forUser: (
    userId: string,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError | InvalidInput | ManagementRateLimited,
    | ManageInvestigations
    | ManageProject
    | ManageResultDeclarations
    | AgentAccess
  >,
) {
  return executeQuery(
    request,
    request.headers.has("x-flowmark-grant-client-id") ||
      request.headers.has("x-flowmark-grant-authorization-code-id")
      ? Effect.fail(new Unauthorized({ permission: "write" }))
      : sessionUserId(request).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(new Unauthorized({ permission: "read" })),
              onSome: (userId) => forUser(userId),
            }),
          ),
        ),
  )
}

export function onboardingQuery<A>(
  request: Request,
  operation: (
    userId: string,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError | InvalidInput | ManagementRateLimited,
    Onboarding
  >,
) {
  return executeQuery(
    request,
    sessionUserId(request).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(new Unauthorized({ permission: "read" })),
          onSome: operation,
        }),
      ),
    ),
  )
}

export function sessionAgentAccessQuery<A>(
  request: Request,
  forUser: (
    userId: string,
  ) => Effect.Effect<
    A,
    Unauthorized | PersistenceError | InvalidInput | ManagementRateLimited,
    AgentAccess
  >,
) {
  return executeQuery(
    request,
    sessionUserId(request).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail(new Unauthorized({ permission: "read" })),
          onSome: forUser,
        }),
      ),
    ),
  )
}
