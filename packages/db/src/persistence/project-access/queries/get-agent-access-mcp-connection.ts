import { and, eq, gt, inArray, isNull, or } from "drizzle-orm"
import { Array as EffectArray, Effect } from "effect"
import {
  agentAccessGrantProjects,
  oauthClient,
  oauthRefreshToken,
  projectMembers,
  projects,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export interface AgentAccessMcpProjectGrant {
  readonly id: string
  readonly name: string
}

export interface AgentAccessMcpConnectionSnapshot {
  readonly authorizationCodeId: string
  readonly clientId: string
  readonly clientName: string | null
  readonly projects: ReadonlyArray<AgentAccessMcpProjectGrant>
}

/** Active grant family with project allowlist intersected with current membership. */
export const getAgentAccessMcpConnection = Effect.fn(
  "getAgentAccessMcpConnection",
)(function* (input: {
  readonly userId: string
  readonly authorizationCodeId: string
  readonly clientId: string
}) {
  const db = yield* Database
  const active = yield* runQuery(
    DatabaseOperation.GetAgentAccessConnectionDetail,
    () =>
      db
        .select({
          clientName: oauthClient.name,
        })
        .from(oauthRefreshToken)
        .innerJoin(
          oauthClient,
          eq(oauthClient.clientId, oauthRefreshToken.clientId),
        )
        .where(
          and(
            eq(oauthRefreshToken.userId, input.userId),
            eq(oauthRefreshToken.clientId, input.clientId),
            eq(
              oauthRefreshToken.authorizationCodeId,
              input.authorizationCodeId,
            ),
            isNull(oauthRefreshToken.revoked),
            or(
              isNull(oauthRefreshToken.expiresAt),
              gt(oauthRefreshToken.expiresAt, new Date()),
            ),
          ),
        )
        .limit(1),
  )
  if (active.length === 0) {
    return undefined
  }
  const grantProjects = yield* runQuery(
    DatabaseOperation.GetAgentAccessConnectionDetail,
    () =>
      db
        .select({ projectId: agentAccessGrantProjects.projectId })
        .from(agentAccessGrantProjects)
        .where(
          eq(
            agentAccessGrantProjects.authorizationCodeId,
            input.authorizationCodeId,
          ),
        ),
  )
  const grantIds = EffectArray.map(grantProjects, (row) => row.projectId)
  if (grantIds.length === 0) {
    return {
      authorizationCodeId: input.authorizationCodeId,
      clientId: input.clientId,
      clientName: active[0]?.clientName ?? null,
      projects: [],
    } satisfies AgentAccessMcpConnectionSnapshot
  }
  const memberProjects = yield* runQuery(
    DatabaseOperation.GetAgentAccessConnectionDetail,
    () =>
      db
        .select({
          id: projects.id,
          name: projects.name,
        })
        .from(projectMembers)
        .innerJoin(projects, eq(projects.id, projectMembers.projectId))
        .where(
          and(
            eq(projectMembers.userId, input.userId),
            inArray(projectMembers.projectId, grantIds),
          ),
        ),
  )
  return {
    authorizationCodeId: input.authorizationCodeId,
    clientId: input.clientId,
    clientName: active[0]?.clientName ?? null,
    projects: EffectArray.map(memberProjects, (row) => ({
      id: row.id,
      name: row.name,
    })),
  } satisfies AgentAccessMcpConnectionSnapshot
})
