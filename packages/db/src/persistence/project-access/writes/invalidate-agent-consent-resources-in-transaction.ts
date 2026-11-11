import { and, eq, sql } from "drizzle-orm"
import {
  agentAccessOauthConsentIntents,
  oauthConsent,
} from "../../../schema/index.js"
import type { FlowmarkDbTransaction } from "./revoke-grant-family-in-transaction.js"

/** Keep consent history, but require project selection again for revoked resources. */
export const invalidateAgentConsentResourcesInTransaction = (
  tx: FlowmarkDbTransaction,
  input: {
    readonly now: Date
    readonly userId: string
    readonly clientId?: string
    readonly authorizationCodeId?: string
  },
) => {
  const selection = and(
    eq(agentAccessOauthConsentIntents.userId, input.userId),
    input.clientId === undefined
      ? undefined
      : eq(agentAccessOauthConsentIntents.clientId, input.clientId),
    input.authorizationCodeId === undefined
      ? undefined
      : eq(
          agentAccessOauthConsentIntents.authorizationCodeId,
          input.authorizationCodeId,
        ),
    eq(agentAccessOauthConsentIntents.oauthConsentId, oauthConsent.id),
  )
  return tx
    .update(oauthConsent)
    .set({
      resources: sql<string[]>`ARRAY(
      SELECT consent_resource.value
      FROM unnest(coalesce(${oauthConsent.resources}, ARRAY[]::text[])) AS consent_resource(value)
      WHERE NOT EXISTS (
        SELECT 1 FROM ${agentAccessOauthConsentIntents}
        WHERE ${selection}
          AND ${agentAccessOauthConsentIntents.resourceUrl} = consent_resource.value
      )
    )`,
      updatedAt: input.now,
    })
    .where(
      and(
        eq(oauthConsent.userId, input.userId),
        sql`EXISTS (SELECT 1 FROM ${agentAccessOauthConsentIntents} WHERE ${selection})`,
      ),
    )
}
