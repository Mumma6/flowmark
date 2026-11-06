import { and, eq, gt, inArray, isNull, or, sql } from "drizzle-orm"
import type { ExtractTablesWithRelations } from "drizzle-orm"
import type { PgTransaction } from "drizzle-orm/pg-core"
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js"
import type * as schema from "../../../schema/index.js"
import {
  agentAccessConnectionLastAuth,
  agentAccessGrantProjects,
  agentAccessOauthConsentIntents,
  oauthAccessToken,
  oauthRefreshToken,
} from "../../../schema/index.js"

type Schema = typeof schema
export type FlowmarkDbTransaction = PgTransaction<
  PostgresJsQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>

/** Shared steps: revoke OAuth refresh family rows and clear Flowmark grant metadata. */
export async function revokeGrantFamilyInTransaction(
  tx: FlowmarkDbTransaction,
  input: {
    readonly now: Date
    readonly userId: string
    readonly authorizationCodeId: string
    readonly clientId: string
    /** Session revoke: mark consent intents revoked. Reconnect supersede: leave intent rows for explicit supersede update. */
    readonly markConsentIntentsRevoked: boolean
  },
) {
  const refreshRows = await tx
    .select({ id: oauthRefreshToken.id })
    .from(oauthRefreshToken)
    .where(
      and(
        eq(oauthRefreshToken.userId, input.userId),
        eq(oauthRefreshToken.clientId, input.clientId),
        eq(oauthRefreshToken.authorizationCodeId, input.authorizationCodeId),
      ),
    )
  const refreshIds = refreshRows.map((r) => r.id)
  if (refreshIds.length > 0) {
    await tx
      .update(oauthAccessToken)
      .set({ revoked: input.now })
      .where(inArray(oauthAccessToken.refreshId, refreshIds))
  }
  await tx
    .update(oauthRefreshToken)
    .set({ revoked: input.now })
    .where(
      and(
        eq(oauthRefreshToken.userId, input.userId),
        eq(oauthRefreshToken.clientId, input.clientId),
        eq(oauthRefreshToken.authorizationCodeId, input.authorizationCodeId),
        isNull(oauthRefreshToken.revoked),
        or(
          isNull(oauthRefreshToken.expiresAt),
          gt(oauthRefreshToken.expiresAt, input.now),
        ),
      ),
    )
  await tx
    .delete(agentAccessGrantProjects)
    .where(
      eq(
        agentAccessGrantProjects.authorizationCodeId,
        input.authorizationCodeId,
      ),
    )
  await tx
    .delete(agentAccessConnectionLastAuth)
    .where(
      eq(
        agentAccessConnectionLastAuth.authorizationCodeId,
        input.authorizationCodeId,
      ),
    )
  if (input.markConsentIntentsRevoked) {
    await tx
      .update(agentAccessOauthConsentIntents)
      .set({ state: "revoked", updatedAt: input.now })
      .where(
        and(
          eq(agentAccessOauthConsentIntents.userId, input.userId),
          eq(
            agentAccessOauthConsentIntents.authorizationCodeId,
            input.authorizationCodeId,
          ),
        ),
      )
  }
}

/** Revoke every non-expired delegated refresh row for the user that has a grant family id. */
export async function revokeAllDelegatedGrantFamiliesForUserInTransaction(
  tx: FlowmarkDbTransaction,
  input: { readonly now: Date; readonly userId: string },
) {
  const refreshRows = await tx
    .select({
      id: oauthRefreshToken.id,
      authorizationCodeId: oauthRefreshToken.authorizationCodeId,
    })
    .from(oauthRefreshToken)
    .where(
      and(
        eq(oauthRefreshToken.userId, input.userId),
        isNull(oauthRefreshToken.revoked),
        or(
          isNull(oauthRefreshToken.expiresAt),
          gt(oauthRefreshToken.expiresAt, input.now),
        ),
        sql`"oauth_refresh_token"."authorization_code_id" IS NOT NULL`,
      ),
    )
  const refreshIds = refreshRows.map((r) => r.id)
  const familyIds = [
    ...new Set(
      refreshRows
        .map((r) => r.authorizationCodeId)
        .filter((x): x is string => x != null && x.length > 0),
    ),
  ]
  if (refreshIds.length > 0) {
    await tx
      .update(oauthAccessToken)
      .set({ revoked: input.now })
      .where(inArray(oauthAccessToken.refreshId, refreshIds))
  }
  await tx
    .update(oauthRefreshToken)
    .set({ revoked: input.now })
    .where(
      and(
        eq(oauthRefreshToken.userId, input.userId),
        isNull(oauthRefreshToken.revoked),
        or(
          isNull(oauthRefreshToken.expiresAt),
          gt(oauthRefreshToken.expiresAt, input.now),
        ),
      ),
    )
  if (familyIds.length > 0) {
    await tx
      .delete(agentAccessGrantProjects)
      .where(inArray(agentAccessGrantProjects.authorizationCodeId, familyIds))
    await tx
      .delete(agentAccessConnectionLastAuth)
      .where(
        inArray(agentAccessConnectionLastAuth.authorizationCodeId, familyIds),
      )
  }
  await tx
    .update(agentAccessOauthConsentIntents)
    .set({ state: "revoked", updatedAt: input.now })
    .where(eq(agentAccessOauthConsentIntents.userId, input.userId))
}
