import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm"
import {
  Array as EffectArray,
  Effect,
  HashMap,
  Option,
  Record,
  pipe,
} from "effect"
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
  return pipe(
    rows,
    EffectArray.groupBy((row) => row.authorizationCodeId),
    Record.map((group) => EffectArray.map(group, (row) => row.projectId)),
  )
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
  const deduped = pipe(
    rows,
    EffectArray.map((row) =>
      Option.fromNullishOr(row.authorizationCodeId).pipe(
        Option.map((authorizationCodeId) => ({ ...row, authorizationCodeId })),
      ),
    ),
    EffectArray.getSomes,
    EffectArray.dedupeWith(
      (left, right) =>
        left.authorizationCodeId === right.authorizationCodeId &&
        left.clientId === right.clientId,
    ),
  )
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
  const lastByFamily = HashMap.fromIterable(
    EffectArray.map(
      lastAuthRows,
      (r) => [r.authorizationCodeId, r.lastAt?.toISOString() ?? null] as const,
    ),
  )
  return EffectArray.map(deduped, (conn) => {
    const createdAt = conn.createdAt ?? new Date(0)
    return {
      authorizationCodeId: conn.authorizationCodeId,
      clientId: conn.clientId,
      clientName: conn.clientName,
      createdAt: createdAt.toISOString(),
      projectIds: projectMap[conn.authorizationCodeId] ?? [],
      lastAuthenticatedAt: HashMap.get(
        lastByFamily,
        conn.authorizationCodeId,
      ).pipe(Option.getOrNull),
    } satisfies AgentAccessConnectionSummary
  })
})
