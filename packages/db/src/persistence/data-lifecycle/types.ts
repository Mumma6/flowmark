import { Data } from "effect"
import type { dataLifecycleOperations } from "../../schema/data-lifecycle.js"
export type {
  ErasureScope,
  ErasureCounts,
} from "../../schema/data-lifecycle.js"
export type LifecycleOperation = typeof dataLifecycleOperations.$inferSelect
export class LifecycleRejected extends Data.TaggedError("LifecycleRejected")<{
  readonly reason:
    | "Unauthorized"
    | "SharedProject"
    | "StalePreview"
    | "Unavailable"
    | "ConfirmationRequired"
    | "UnsupportedVersion"
}> {}
