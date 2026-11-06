import { and, eq, gt, isNull, or } from "drizzle-orm"
import { Array as EffectArray, Effect } from "effect"
import {
  agentAccessConnectionLastAuth,
  agentAccessGrantProjects,
  oauthClient,
  oauthRefreshToken,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import type { AgentAccessConnectionSummary } from "./list-agent-access-connections.js"

export const getAgentAccessConnectionDetail = Effect.fn(
  "getAgentAccessConnectionDetail",
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
          createdAt: oauthRefreshToken.createdAt,
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
        .orderBy(oauthRefreshToken.createdAt)
        .limit(1),
  )
  if (active.length === 0) {
    return undefined
  }
  const projectRows = yield* runQuery(
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
  const [lastRow] = yield* runQuery(
    DatabaseOperation.GetAgentAccessConnectionDetail,
    () =>
      db
        .select({
          lastAt: agentAccessConnectionLastAuth.lastAuthenticatedAt,
        })
        .from(agentAccessConnectionLastAuth)
        .where(
          and(
            eq(
              agentAccessConnectionLastAuth.authorizationCodeId,
              input.authorizationCodeId,
            ),
            eq(agentAccessConnectionLastAuth.userId, input.userId),
          ),
        )
        .limit(1),
  )
  const createdAt = active[0]?.createdAt ?? new Date(0)
  return {
    authorizationCodeId: input.authorizationCodeId,
    clientId: input.clientId,
    clientName: active[0]?.clientName ?? null,
    createdAt: createdAt.toISOString(),
    projectIds: EffectArray.map(projectRows, (p) => p.projectId),
    lastAuthenticatedAt: lastRow?.lastAt?.toISOString() ?? null,
  } satisfies AgentAccessConnectionSummary
})
