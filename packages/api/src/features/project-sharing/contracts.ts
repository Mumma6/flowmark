import { Schema } from "effect"
export const SharingUuid = Schema.String.check(
  Schema.isPattern(
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
  ),
)
const SessionId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(256),
)
export const InviteProjectSchema = Schema.Struct({
  projectId: SharingUuid,
  currentSessionId: SessionId,
  role: Schema.optional(Schema.Literals(["viewer", "business"])),
  email: Schema.String.check(
    Schema.isMaxLength(254),
    Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  ),
  password: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1024),
  ),
})
export const ReviewInvitationSchema = Schema.Struct({
  id: SharingUuid,
  currentSessionId: SessionId,
  token: Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
  action: Schema.Literals(["review", "accept", "decline"]),
})
export const InvitationReviewSchema = Schema.Struct({
  projectId: SharingUuid,
  projectName: Schema.String,
  inviterName: Schema.String,
  expiresAt: Schema.String,
  role: Schema.Literals(["viewer", "business"]),
  action: Schema.Literals(["review", "accept", "decline"]),
})
export type InvitationReview = typeof InvitationReviewSchema.Type
export const ProjectSharingSchema = Schema.Struct({
  userId: Schema.String,
  projectId: SharingUuid,
  projectName: Schema.String,
  ownerName: Schema.String,
  role: Schema.Literals(["owner", "viewer", "business"]),
  members: Schema.Array(
    Schema.Struct({
      userId: Schema.String,
      name: Schema.String,
      email: Schema.String,
      role: Schema.Literals(["owner", "viewer", "business"]),
    }),
  ),
  invitations: Schema.Array(
    Schema.Struct({
      id: SharingUuid,
      email: Schema.String,
      expiresAt: Schema.String,
      role: Schema.Literals(["viewer", "business"]),
      delivery: Schema.Literals(["pending", "submitted", "failed"]),
    }),
  ),
})
export type ProjectSharingDetails = typeof ProjectSharingSchema.Type
