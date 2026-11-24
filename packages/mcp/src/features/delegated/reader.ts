import { DelegatedUser, type ProjectReader } from "@flowmark/api"
import type { FlowmarkMcpAuthInfo } from "../../auth/claims.js"

export const mcpDelegatedReader = (
  identity: FlowmarkMcpAuthInfo,
  familyId: string,
  projectId: string,
): ProjectReader =>
  DelegatedUser({
    userId: identity.subjectUserId,
    clientId: identity.clientId,
    authorizationCodeId: familyId,
    projectId,
  })
