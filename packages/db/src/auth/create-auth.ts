import { betterAuth } from "better-auth"
import { drizzleAdapter } from "@better-auth/drizzle-adapter"
import { Data, Effect } from "effect"
import type { FlowmarkDatabase } from "../client.js"
import { LOCAL_DEV_AUTH_SECRET } from "../fixtures/demo.js"
import { account, session, user, verification } from "../schema/auth.js"
import { acceptLocalDevEmail } from "./accept-local-dev-email.js"

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
    plugins: [acceptLocalDevEmail()],
  })
}
