import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { betterAuth, type BetterAuthOptions } from "better-auth"
import { Cause, Data, Effect, Exit } from "effect"
import { LOCAL_DEV_AUTH_SECRET } from "@flowmark/db/demo"
import { account, session, user, verification } from "@flowmark/db/schema"
import type { FlowmarkDatabase } from "@flowmark/db"
import { accountRateLimits } from "./account-rate-limits.js"
import {
  AUTH_CLIENT_IP_HEADER,
  normalizeAuthClientIdentity,
} from "./client-identity.js"
import type { Email } from "@flowmark/email"
import { createAuthEmailCallbacks } from "./email-callbacks.js"
import { createAuthRateLimitStorage } from "./rate-limit-storage.js"
import {
  alignAgentAccessWithBaseUrl,
  flowmarkAgentAccessPlugins,
  flowmarkAgentAccessSchema,
} from "./agent-access/compose-provider.js"

/** Optional hook after primary-account password changes (reset or credential update). */
export type RevokeDelegatedAgentAccess = (userId: string) => Promise<void>

class AuthRequestError extends Data.TaggedError("AuthRequestError")<{
  readonly cause: unknown
}> {}

export type FlowmarkAuth = ReturnType<typeof createFlowmarkAuth>

export class AuthConfigurationError extends Data.TaggedError(
  "AuthConfigurationError",
)<{
  readonly cause: unknown
}> {}

const isProductionRuntime = (env: NodeJS.ProcessEnv) =>
  env.NODE_ENV === "production" || env.VERCEL_ENV === "production"

export const readAuthSecret = Effect.fn("readAuthSecret")(function* (
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.BETTER_AUTH_SECRET) {
    return env.BETTER_AUTH_SECRET
  }
  if (env.FLOWMARK_DEMO_MODE === "true" && !isProductionRuntime(env)) {
    return LOCAL_DEV_AUTH_SECRET
  }
  return yield* new AuthConfigurationError({
    cause: new Error("BETTER_AUTH_SECRET is required outside local demo mode."),
  })
})

export function createFlowmarkAuth(options: {
  readonly db: FlowmarkDatabase
  readonly secret: string
  readonly baseURL?: string
  readonly trustedOrigins?: ReadonlyArray<string>
  readonly emailDelivery?: Email["Service"]
  readonly scheduleEmail?: (task: Promise<unknown>) => void
  /**
   * Revoke delegated agent OAuth grant families for this user (e.g. after password reset).
   * Runs before `emailAndPassword.onPasswordReset` when both are set.
   */
  readonly onRevokeDelegatedAgentAccess?: RevokeDelegatedAgentAccess
  /** Omitted or absent keeps agent OAuth/MCP discovery off. */
  readonly agentAccess?: {
    readonly issuerOrigin: string
    readonly apiOrigin: string
  }
}): ReturnType<typeof betterAuth> {
  const storage = createAuthRateLimitStorage(options.db, options.secret)
  const sourceRule = (max: number) => (request: Request) =>
    request.headers.has(AUTH_CLIENT_IP_HEADER)
      ? { window: 60, max }
      : (false as const)
  const email = options.emailDelivery
    ? createAuthEmailCallbacks(options.emailDelivery, options.scheduleEmail)
    : undefined
  const baseURL =
    options.baseURL ??
    process.env.BETTER_AUTH_URL ??
    process.env.FLOWMARK_DASHBOARD_ORIGIN ??
    "http://localhost:3001"
  const agentAccess = options.agentAccess
    ? Effect.runSync(
        alignAgentAccessWithBaseUrl(options.agentAccess, baseURL).pipe(
          Effect.mapError((cause) => new AuthConfigurationError({ cause })),
        ),
      )
    : undefined
  const configuration: BetterAuthOptions = {
    appName: "Flowmark",
    secret: options.secret,
    // Provider diagnostics can contain callback URLs, headers and DB errors.
    // Keep their severity, never their raw message or arguments.
    logger: {
      log: (level) =>
        console[level]("[Flowmark auth] Provider diagnostic", { level }),
    },
    baseURL,
    trustedOrigins: [
      ...(options.trustedOrigins ?? []),
      process.env.FLOWMARK_DASHBOARD_ORIGIN ?? "http://localhost:3001",
    ],
    database: drizzleAdapter(options.db, {
      provider: "pg",
      transaction: true,
      schema: {
        user,
        session,
        account,
        verification,
        ...(agentAccess ? flowmarkAgentAccessSchema : {}),
      },
    }),
    // Email ownership is proved by a recovery link when needed, not a login gate.
    verification: {
      storeIdentifier: {
        default: "plain",
        overrides: { "reset-password:": "hashed" },
      },
    },
    user: { changeEmail: { enabled: false } },
    emailVerification: email?.emailVerification,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
      ...(email?.emailAndPassword ?? {}),
      onPasswordReset: async (data, request) => {
        if (options.onRevokeDelegatedAgentAccess) {
          await options.onRevokeDelegatedAgentAccess(data.user.id)
        }
        await email?.emailAndPassword?.onPasswordReset?.(data, request)
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 300,
      customStorage: storage,
      customRules: {
        "/oauth2/authorize": false,
        "/oauth2/token": false,
        "/oauth2/revoke": false,
        "/sign-in/email": sourceRule(60),
        "/sign-up/email": sourceRule(20),
        "/request-password-reset": sourceRule(30),
        "/send-verification-email": sourceRule(30),
        "/change-password": sourceRule(30),
        "/change-email": sourceRule(30),
        "/reset-password": sourceRule(30),
        // A high service safety ceiling for non-email endpoints with no trusted
        // source. Email entry points above use per-account budgets instead.
        "/**": (request) => ({
          window: 60,
          max: request.headers.has(AUTH_CLIENT_IP_HEADER) ? 300 : 2000,
        }),
      },
    },
    plugins: [
      accountRateLimits(storage),
      ...(agentAccess ? flowmarkAgentAccessPlugins(agentAccess) : []),
    ] as BetterAuthOptions["plugins"],
    // Keep the same provider CSRF/origin checks in tests and deployed requests.
    advanced: {
      backgroundTasks:
        options.emailDelivery && options.scheduleEmail
          ? { handler: options.scheduleEmail }
          : undefined,
      disableOriginCheck: false,
      disableCSRFCheck: false,
      ipAddress: { ipAddressHeaders: [AUTH_CLIENT_IP_HEADER] },
    },
  }
  const auth = betterAuth(configuration)
  // Explicit provider HTTP boundary: normalize trust before the native limiter.
  const handler = async (request: Request) => {
    const startedAt = Date.now()
    const isRecoveryRequest = new URL(request.url).pathname
      .replace(/\/$/, "")
      .endsWith("/request-password-reset")
    const result = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const normalized = yield* normalizeAuthClientIdentity(request)
        return yield* Effect.tryPromise({
          try: () => auth.handler(normalized),
          catch: (cause) => new AuthRequestError({ cause }),
        })
      }).pipe(
        Effect.tap(() =>
          isRecoveryRequest
            ? Effect.sleep(Math.max(0, 500 - (Date.now() - startedAt)))
            : Effect.void,
        ),
        Effect.catchTag("AuthClientIdentityError", (error) =>
          Effect.succeed(
            Response.json(
              { message: "Authentication request could not be accepted." },
              {
                status: error.reason === "invalid" ? 403 : 503,
                headers: { "cache-control": "no-store" },
              },
            ),
          ),
        ),
      ),
    )
    return Exit.match(result, {
      onSuccess: (response) => {
        if (response.status >= 500) {
          return Response.json(
            { message: "Authentication is temporarily unavailable." },
            { status: 503, headers: { "cache-control": "no-store" } },
          )
        }
        if (response.status === 429) {
          const headers = new Headers(response.headers)
          const retry =
            headers.get("retry-after") ?? headers.get("x-retry-after")
          if (retry) {
            headers.set("retry-after", retry)
            headers.set("x-retry-after", retry)
          }
          headers.set("cache-control", "no-store")
          return new Response(response.body, {
            status: response.status,
            headers,
          })
        }
        return response
      },
      onFailure: (cause) => {
        const failed = cause.reasons.find(Cause.isFailReason)
        const source =
          failed?.error.cause ?? cause.reasons.find(Cause.isDieReason)?.defect
        const type =
          source instanceof Error &&
          [
            "TypeError",
            "ReferenceError",
            "Error",
            "DatabaseError",
            "DrizzleQueryError",
            "PostgresError",
            "FiberFailure",
          ].includes(source.name)
            ? source.name
            : "unknown"
        const record = source as
          | {
              readonly operation?: unknown
              readonly cause?: {
                readonly code?: unknown
                readonly cause?: { readonly code?: unknown }
              }
            }
          | undefined
        const rawCode = record?.cause?.code ?? record?.cause?.cause?.code
        const code =
          typeof rawCode === "string" &&
          ["42P01", "42703", "ECONNREFUSED", "28P01", "3D000"].includes(rawCode)
            ? rawCode
            : undefined
        console.error("[Flowmark auth] Request failed", {
          type,
          code,
          operation:
            record?.operation === "auth-rate-limit"
              ? "auth-rate-limit"
              : undefined,
        })
        return Response.json(
          { message: "Authentication is temporarily unavailable." },
          { status: 503, headers: { "cache-control": "no-store" } },
        )
      },
    })
  }
  return { ...auth, handler, fetch: handler }
}
