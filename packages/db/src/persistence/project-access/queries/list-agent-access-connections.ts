import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm"
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

export interface AgentAccessConnectionSummary {
  readonly authorizationCodeId: string
  readonly clientId: string
  readonly clientName: string | null
  readonly createdAt: string
  readonly projectIds: ReadonlyArray<string>
  readonly lastAuthenticatedAt: string | null
}

const projectsByFamily = (
  rows: ReadonlyArray<{
    readonly authorizationCodeId: string
    readonly projectId: string
  }>,
) => {
  const map = new Map<string, Array<string>>()
  for (const row of rows) {
    const list = map.get(row.authorizationCodeId)
    if (list) {
      list.push(row.projectId)
    } else {
      map.set(row.authorizationCodeId, [row.projectId])
    }
  }
  return map
}

export const listAgentAccessConnections = Effect.fn(
  "listAgentAccessConnections",
)(function* (userId: string) {
  const db = yield* Database
  const rows = yield* runQuery(
    DatabaseOperation.ListAgentAccessConnections,
    () =>
      db
        .select({
          authorizationCodeId: oauthRefreshToken.authorizationCodeId,
          clientId: oauthRefreshToken.clientId,
          clientName: oauthClient.name,
          createdAt: oauthRefreshToken.createdAt,
        })
        .from(oauthRefreshToken)
        .innerJoin(
          oauthClient,
          eq(oauthClient.clientId, oauthRefreshToken.clientId),
        )
        .where(
          and(
            eq(oauthRefreshToken.userId, userId),
            isNull(oauthRefreshToken.revoked),
            or(
              isNull(oauthRefreshToken.expiresAt),
              gt(oauthRefreshToken.expiresAt, new Date()),
            ),
          ),
        )
        .orderBy(desc(oauthRefreshToken.createdAt)),
  )
  const deduped: Array<{
    readonly authorizationCodeId: string
    readonly clientId: string
    readonly clientName: string | null
    readonly createdAt: Date | null
  }> = []
  const seen = new Set<string>()
  for (const row of rows) {
    const familyId = row.authorizationCodeId
    const clientId = row.clientId
    if (!familyId) {
      continue
    }
    const key = `${familyId}:${clientId}`
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push({
      authorizationCodeId: familyId,
      clientId,
      clientName: row.clientName,
      createdAt: row.createdAt,
    })
  }
  const familyIds = EffectArray.map(deduped, (d) => d.authorizationCodeId)
  const grantRows =
    familyIds.length === 0
      ? []
      : yield* runQuery(DatabaseOperation.ListAgentAccessConnections, () =>
          db
            .select({
              authorizationCodeId: agentAccessGrantProjects.authorizationCodeId,
              projectId: agentAccessGrantProjects.projectId,
            })
            .from(agentAccessGrantProjects)
            .where(
              inArray(agentAccessGrantProjects.authorizationCodeId, familyIds),
            ),
        )
  const projectMap = projectsByFamily(grantRows)
  const lastAuthRows =
    familyIds.length === 0
      ? []
      : yield* runQuery(DatabaseOperation.ListAgentAccessConnections, () =>
          db
            .select({
              authorizationCodeId:
                agentAccessConnectionLastAuth.authorizationCodeId,
              lastAt: agentAccessConnectionLastAuth.lastAuthenticatedAt,
            })
            .from(agentAccessConnectionLastAuth)
            .where(
              and(
                eq(agentAccessConnectionLastAuth.userId, userId),
                inArray(
                  agentAccessConnectionLastAuth.authorizationCodeId,
                  familyIds,
                ),
              ),
            ),
        )
  const lastByFamily = new Map(
    EffectArray.map(lastAuthRows, (r) => [
      r.authorizationCodeId,
      r.lastAt?.toISOString() ?? null,
    ]),
  )
  return EffectArray.map(deduped, (conn) => {
    const createdAt = conn.createdAt ?? new Date(0)
    return {
      authorizationCodeId: conn.authorizationCodeId,
      clientId: conn.clientId,
      clientName: conn.clientName,
      createdAt: createdAt.toISOString(),
      projectIds: projectMap.get(conn.authorizationCodeId) ?? [],
      lastAuthenticatedAt: lastByFamily.get(conn.authorizationCodeId) ?? null,
    } satisfies AgentAccessConnectionSummary
  })
})
