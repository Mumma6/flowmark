import { randomBytes } from "node:crypto"
import { apiKeyPrefix, hashApiKey } from "../../database.js"

export type ProjectKeyKind = "read" | "write" | "browser"

export function generateProjectKey(kind: ProjectKeyKind) {
  const secret = `fm_${kind}_${randomBytes(24).toString("base64url")}`
  return {
    secret,
    prefix: apiKeyPrefix(secret),
    hash: hashApiKey(secret),
  }
}
