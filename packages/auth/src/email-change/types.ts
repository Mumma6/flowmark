import type { BetterAuthOptions, betterAuth } from "better-auth"
import { Context, Data } from "effect"
import type { Email } from "@flowmark/email"
import type { FlowmarkDatabase } from "@flowmark/db"
import type { createAuthRateLimitStorage } from "../rate-limit-storage.js"

export class AccountEmailError extends Data.TaggedError("AccountEmailError")<{
  readonly reason:
    | "SignInRequired"
    | "NeedsVerification"
    | "PasswordRejected"
    | "RateLimited"
    | "Changed"
    | "Unavailable"
    | "DeliveryFailed"
    | "InvalidInput"
    | "InvalidLink"
  readonly cause?: unknown
}> {}
export type NativeProvider = ReturnType<typeof betterAuth>
export type NativeEmail = {
  readonly user: { readonly id: string; readonly email: string }
  readonly token: string
  readonly url: string
}
export type OldEmail = NativeEmail & { readonly newEmail: string }
export interface ProofCallbacks {
  readonly old: (input: OldEmail) => Promise<void>
  readonly next: (input: NativeEmail) => Promise<void>
}
export interface AccountEmailRuntimeService {
  readonly auth: NativeProvider
  readonly baseURL: string
  readonly trustedOrigins: ReadonlyArray<string>
  readonly delivery: Email["Service"] | undefined
  readonly consume: ReturnType<typeof createAuthRateLimitStorage>["consume"]
  readonly scoped: (
    database: FlowmarkDatabase,
    callbacks: ProofCallbacks,
  ) => NativeProvider
}
export class AccountEmailRuntime extends Context.Service<
  AccountEmailRuntime,
  AccountEmailRuntimeService
>()("@flowmark/auth/AccountEmailRuntime") {}
export type NativeChangeEmailOptions = NonNullable<
  NonNullable<BetterAuthOptions["user"]>["changeEmail"]
>
