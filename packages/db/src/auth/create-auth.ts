import { betterAuth } from "better-auth"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { Data, Effect } from "effect"
import type { FlowmarkDatabase } from "../client.js"
import { LOCAL_DEV_AUTH_SECRET } from "../fixtures/demo.js"
import { account, session, user, verification } from "../schema/auth.js"

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
}) {
  return betterAuth({
    appName: "Flowmark",
    secret: options.secret,
    // Provider diagnostics can contain callback URLs, headers and DB errors.
    // Keep their severity, never their raw message or arguments.
    logger: {
      log: (level) =>
        console[level]("[Flowmark auth] Provider diagnostic", { level }),
    },
    baseURL:
      options.baseURL ??
      process.env.BETTER_AUTH_URL ??
      process.env.FLOWMARK_DASHBOARD_ORIGIN ??
      "http://localhost:3001",
    trustedOrigins: [
      ...(options.trustedOrigins ?? []),
      process.env.FLOWMARK_DASHBOARD_ORIGIN ?? "http://localhost:3001",
    ],
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },
    // Keep the same provider CSRF/origin checks in tests and deployed requests.
    advanced: {
      disableOriginCheck: false,
      disableCSRFCheck: false,
    },
  })
}
