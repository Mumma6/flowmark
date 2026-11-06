import { and, eq, gt, isNull, or } from "drizzle-orm"
import { Effect } from "effect"
import { oauthRefreshToken } from "../../../schema/index.js"
import { AgentAccessNotFound } from "../agent-access-errors.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  revokeAllDelegatedGrantFamiliesForUserInTransaction,
  revokeGrantFamilyInTransaction,
} from "./revoke-grant-family-in-transaction.js"

/**
 * Revoke one delegated connection (grant family): marks refresh/access tokens revoked,
 * drops Flowmark grant rows and last-auth; marks consent intent revoked.
 */
export const revokeAgentAccessConnection = Effect.fn(
  "revokeAgentAccessConnection",
)(function* (input: {
  readonly userId: string
  readonly authorizationCodeId: string
  readonly clientId: string
}) {
  const db = yield* Database
  const now = new Date()
  const revoked = yield* runQuery(
    DatabaseOperation.RevokeAgentAccessConnection,
    () =>
      db.transaction(async (tx) => {
        const [active] = await tx
          .select({ id: oauthRefreshToken.id })
          .from(oauthRefreshToken)
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
                gt(oauthRefreshToken.expiresAt, now),
              ),
            ),
          )
          .limit(1)
        if (!active) {
          return false
        }
        await revokeGrantFamilyInTransaction(tx, {
          now,
          userId: input.userId,
          authorizationCodeId: input.authorizationCodeId,
          clientId: input.clientId,
          markConsentIntentsRevoked: true,
        })
        return true
      }),
  )
  if (!revoked) {
    return yield* Effect.fail(
      new AgentAccessNotFound({
        userId: input.userId,
        clientId: input.clientId,
        authorizationCodeId: input.authorizationCodeId,
      }),
    )
  }
})

/**
 * Invalidate all active delegated OAuth refresh families for the account (e.g. password reset).
 */
export const revokeAllAgentAccessConnectionsForUser = Effect.fn(
  "revokeAllAgentAccessConnectionsForUser",
)(function* (userId: string) {
  const db = yield* Database
  const now = new Date()
  yield* runQuery(
    DatabaseOperation.RevokeAllAgentAccessConnectionsForUser,
    () =>
      db.transaction(async (tx) => {
        await revokeAllDelegatedGrantFamiliesForUserInTransaction(tx, {
          now,
          userId,
        })
      }),
  )
})
