import type { ProjectReader } from "@flowmark/api"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"

export const mcpDelegatedReader = (
  identity: FlowmarkMcpAuthInfo,
  familyId: string,
  projectId: string,
): ProjectReader => ({
  _tag: "DelegatedUser",
  userId: identity.subjectUserId,
  clientId: identity.clientId,
  authorizationCodeId: familyId,
  projectId,
})
