import { Data } from "effect"
import type { accountLifecycleOperations } from "../../schema/account-lifecycle.js"
export type AccountLifecycleOperation =
  typeof accountLifecycleOperations.$inferSelect
export class AccountLifecycleRejected extends Data.TaggedError(
  "AccountLifecycleRejected",
)<{
  readonly reason:
    | "Unauthorized"
    | "InvalidCapability"
    | "SharedProject"
    | "StalePreview"
    | "Unavailable"
    | "ConfirmationRequired"
    | "UnsupportedVersion"
}> {}
