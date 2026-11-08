import { and, arrayContains, eq, gt, isNull, or } from "drizzle-orm"
import { Effect } from "effect"
import { oauthRefreshToken } from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

/** Match the signed token's exact family, including current shared revocation state. */
export const getAgentAccessGrantFamily = Effect.fn("getAgentAccessGrantFamily")(
  function* (input: {
    readonly subjectUserId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly resource: string
  }) {
    const db = yield* Database
    const [row] = yield* runQuery(
      DatabaseOperation.GetAgentAccessGrantFamily,
      () =>
        db
          .select({ familyId: oauthRefreshToken.authorizationCodeId })
          .from(oauthRefreshToken)
          .where(
            and(
              eq(
                oauthRefreshToken.authorizationCodeId,
                input.authorizationCodeId,
              ),
              eq(oauthRefreshToken.userId, input.subjectUserId),
              eq(oauthRefreshToken.clientId, input.clientId),
              arrayContains(oauthRefreshToken.resources, [input.resource]),
              isNull(oauthRefreshToken.revoked),
              or(
                isNull(oauthRefreshToken.expiresAt),
                gt(oauthRefreshToken.expiresAt, new Date()),
              ),
            ),
          )
          .limit(1),
    )
    return row?.familyId ?? undefined
  },
)
