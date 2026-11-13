import { Data } from "effect"
import type { projectInvitations } from "../../schema/index.js"
export type InvitationRecord = typeof projectInvitations.$inferSelect
export class SharingRejected extends Data.TaggedError("SharingRejected")<{
  readonly reason:
    "Unauthorized" | "InvalidInvitation" | "LimitReached" | "Unavailable"
}> {}
