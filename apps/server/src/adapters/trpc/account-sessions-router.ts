import { TRPCError } from "@trpc/server"
import { Cause, Effect, Exit, Match, Schema } from "effect"
import { AccountSessionError } from "@flowmark/auth"
import { Redacted } from "effect"
import { getAuth } from "../../auth"
import { t } from "./context"
import { studioMutation } from "./studio-origin"

const reasons = {
  SessionChanged: {
    code: "CONFLICT",
    message:
      "Your sign-in changed. Refresh sessions and review the scope again.",
  },
  SignInRequired: {
    code: "UNAUTHORIZED",
    message: "Sign in again to manage your sessions.",
  },
  PasswordRejected: {
    code: "BAD_REQUEST",
    message: "Current password was not accepted.",
  },
  RateLimited: {
    code: "TOO_MANY_REQUESTS",
    message: "Too many verification attempts. Try again in 15 minutes.",
  },
  SessionUnavailable: {
    code: "NOT_FOUND",
    message: "That session is no longer available. Refresh the list.",
  },
  CurrentSession: {
    code: "BAD_REQUEST",
    message: "Use Sign out on this device to end the current session.",
  },
  Unavailable: {
    code: "INTERNAL_SERVER_ERROR",
    message:
      "Session management is temporarily unavailable. Refresh before retrying.",
  },
} as const

const execute = async <A, E>(
  request: Request,
  operation: Effect.Effect<A, E>,
) => {
  if (
    request.headers.has("authorization") ||
    request.headers.has("x-flowmark-grant-client-id")
  ) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "A browser session is required.",
    })
  }
  const result = await Effect.runPromiseExit(operation, {
    signal: request.signal,
  })
  return Exit.match(result, {
    onSuccess: (value) => value,
    onFailure: (cause) => {
      const reason =
        cause.reasons.length === 1 && Cause.isFailReason(cause.reasons[0])
          ? Match.value(cause.reasons[0].error as unknown).pipe(
              Match.when(
                (error: unknown): error is AccountSessionError =>
                  error instanceof AccountSessionError,
                (error) => reasons[error.reason],
              ),
              Match.orElse(() => reasons.Unavailable),
            )
          : reasons.Unavailable
      throw new TRPCError(reason)
    },
  })
}
const Target = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("single"),
    sessionId: Schema.String.check(
      Schema.isMinLength(1),
      Schema.isMaxLength(256),
    ),
  }),
  Schema.Struct({ kind: Schema.Literal("others") }),
])
export const accountSessionsRouter = t.router({
  list: t.procedure.query(({ ctx }) =>
    execute(
      ctx.request,
      Effect.flatMap(getAuth(), (auth) =>
        auth.accountSessions.list(ctx.request.headers),
      ),
    ),
  ),
  revoke: studioMutation
    .input(
      Schema.toStandardSchemaV1(
        Schema.Struct({
          currentSessionId: Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(256),
          ),
          target: Target,
          password: Schema.String.check(
            Schema.isMinLength(1),
            Schema.isMaxLength(1024),
          ),
        }),
        { parseOptions: { onExcessProperty: "error" } },
      ),
    )
    .mutation(({ ctx, input }) =>
      execute(
        ctx.request,
        Effect.flatMap(getAuth(), (auth) =>
          auth.accountSessions.revoke(
            ctx.request.headers,
            input.currentSessionId,
            input.target,
            Redacted.make(input.password),
          ),
        ),
      ),
    ),
})
