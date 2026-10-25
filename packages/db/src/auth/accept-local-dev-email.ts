import type { BetterAuthPlugin } from "better-auth"
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware,
} from "better-auth/api"
import { setSessionCookie } from "better-auth/cookies"
import * as z from "zod"

const loginEmail = (email: string) => /^[^\s@]+@[^\s@]+$/.test(email)

/**
 * Better Auth's built-in `z.email()` rejects `local@dev`. Keep that fixture
 * address usable for the seeded local dashboard account.
 */
export const acceptLocalDevEmail = (): BetterAuthPlugin => ({
  id: "flowmark-accept-local-dev-email",
  endpoints: {
    signInEmail: createAuthEndpoint(
      "/sign-in/email",
      {
        method: "POST",
        use: [formCsrfMiddleware],
        body: z.object({
          email: z.string(),
          password: z.string(),
          callbackURL: z.string().optional(),
          rememberMe: z.boolean().optional(),
        }),
      },
      async (ctx) => {
        if (!ctx.context.options.emailAndPassword?.enabled) {
          throw new APIError("BAD_REQUEST", {
            message: "Email and password is not enabled",
          })
        }
        const { email, password } = ctx.body
        if (!loginEmail(email)) {
          throw new APIError("BAD_REQUEST", { message: "Invalid email" })
        }
        const userRecord = await ctx.context.internalAdapter.findUserByEmail(
          email.toLowerCase(),
          { includeAccounts: true },
        )
        const credentialAccount = userRecord?.accounts.find(
          (account) =>
            account.providerId === "credential" &&
            account.accountId === userRecord.user.id,
        )
        if (!userRecord || !credentialAccount?.password) {
          await ctx.context.password.hash(password)
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid email or password",
          })
        }
        const valid = await ctx.context.password.verify({
          hash: credentialAccount.password,
          password,
        })
        if (!valid) {
          throw new APIError("UNAUTHORIZED", {
            message: "Invalid email or password",
          })
        }
        const session = await ctx.context.internalAdapter.createSession(
          userRecord.user.id,
          ctx.body.rememberMe === false,
        )
        if (!session) {
          throw new APIError("UNAUTHORIZED", {
            message: "Failed to create session",
          })
        }
        await setSessionCookie(
          ctx,
          { session, user: userRecord.user },
          ctx.body.rememberMe === false,
        )
        return ctx.json({
          redirect: false,
          token: session.token,
          user: userRecord.user,
        })
      },
    ),
  },
})
