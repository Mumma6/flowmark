import { createHash } from "node:crypto"

export const REGISTRATION_INVITE_HEADER = "x-flowmark-registration-invite"
export const validInvitationToken = (token: unknown): token is string =>
  typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)
export const hashInvitationToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")
