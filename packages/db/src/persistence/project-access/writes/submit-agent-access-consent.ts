import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm"
import { Array as EffectArray, Effect } from "effect"
import {
  agentAccessGrantProjects,
  agentAccessOauthConsentIntents,
  oauthClient,
  oauthConsent,
  oauthRefreshToken,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { AgentAccessConsentRejected } from "../agent-access-errors.js"
import { getMemberProject } from "../queries/get-member-project.js"
import { revokeGrantFamilyInTransaction } from "./revoke-grant-family-in-transaction.js"

const MAX_PROJECTS = 10

const scopeSetsEqual = (
  a: ReadonlyArray<string> | null | undefined,
  b: ReadonlyArray<string> | null | undefined,
) => {
  const as = [...(a ?? [])].map((s) => s.trim()).filter((s) => s.length > 0)
  const bs = [...(b ?? [])].map((s) => s.trim()).filter((s) => s.length > 0)
  if (as.length !== bs.length) {
    return false
  }
  const sortCopy = (xs: Array<string>) =>
    [...xs].sort((x, y) => x.localeCompare(y))
  return JSON.stringify(sortCopy(as)) === JSON.stringify(sortCopy(bs))
}

export const submitAgentAccessConsent = Effect.fn("submitAgentAccessConsent")(
  function* (input: {
    readonly userId: string
    readonly oauthConsentId: string
    readonly clientId: string
    readonly redirectUri: string
    readonly requestedScopes: ReadonlyArray<string>
    readonly resourceUrl: string
    readonly projectIds: ReadonlyArray<string>
  }) {
    if (input.projectIds.length === 0) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason: "At least one project id is required.",
        }),
      )
    }
    if (input.projectIds.length > MAX_PROJECTS) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason: `At most ${MAX_PROJECTS} projects per authorization version.`,
        }),
      )
    }
    const uniqueProjects = EffectArray.dedupe(input.projectIds)
    if (uniqueProjects.length !== input.projectIds.length) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({ reason: "Duplicate project ids." }),
      )
    }
    for (const projectId of uniqueProjects) {
      const member = yield* getMemberProject(input.userId, projectId)
      if (!member) {
        return yield* Effect.fail(
          new AgentAccessConsentRejected({
            reason: "One or more projects are not in this account.",
          }),
        )
      }
    }
    const db = yield* Database
    const [consent] = yield* runQuery(
      DatabaseOperation.SubmitAgentAccessConsent,
      () =>
        db
          .select({
            id: oauthConsent.id,
            clientId: oauthConsent.clientId,
            userId: oauthConsent.userId,
            scopes: oauthConsent.scopes,
            resources: oauthConsent.resources,
          })
          .from(oauthConsent)
          .where(eq(oauthConsent.id, input.oauthConsentId))
          .limit(1),
    )
    if (!consent || consent.userId !== input.userId) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason: "Consent transaction not found for this account.",
        }),
      )
    }
    if (consent.clientId !== input.clientId) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason: "Client does not match stored consent.",
        }),
      )
    }
    if (!scopeSetsEqual(consent.scopes, input.requestedScopes)) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason: "Requested scopes do not match stored consent.",
        }),
      )
    }
    const resourceList = consent.resources ?? []
    if (
      resourceList.length === 0 ||
      !resourceList.includes(input.resourceUrl)
    ) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason: "Resource does not match stored consent.",
        }),
      )
    }
    const [client] = yield* runQuery(
      DatabaseOperation.SubmitAgentAccessConsent,
      () =>
        db
          .select({ redirectUris: oauthClient.redirectUris })
          .from(oauthClient)
          .where(eq(oauthClient.clientId, input.clientId))
          .limit(1),
    )
    const allowedRedirects = client?.redirectUris ?? []
    if (!allowedRedirects.includes(input.redirectUri)) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason: "Redirect URI is not registered for this client.",
        }),
      )
    }
    const [priorIntent] = yield* runQuery(
      DatabaseOperation.SubmitAgentAccessConsent,
      () =>
        db
          .select({
            authorizationCodeId:
              agentAccessOauthConsentIntents.authorizationCodeId,
          })
          .from(agentAccessOauthConsentIntents)
          .where(
            and(
              eq(
                agentAccessOauthConsentIntents.oauthConsentId,
                input.oauthConsentId,
              ),
              eq(agentAccessOauthConsentIntents.userId, input.userId),
              eq(agentAccessOauthConsentIntents.clientId, input.clientId),
            ),
          )
          .limit(1),
    )
    const priorAuthorizationCodeId = priorIntent?.authorizationCodeId

    const refreshRows = yield* runQuery(
      DatabaseOperation.SubmitAgentAccessConsent,
      () =>
        db
          .select({
            authorizationCodeId: oauthRefreshToken.authorizationCodeId,
          })
          .from(oauthRefreshToken)
          .where(
            and(
              eq(oauthRefreshToken.userId, input.userId),
              eq(oauthRefreshToken.clientId, input.clientId),
              isNull(oauthRefreshToken.revoked),
              or(
                isNull(oauthRefreshToken.expiresAt),
                gt(oauthRefreshToken.expiresAt, new Date()),
              ),
              sql`"oauth_refresh_token"."authorization_code_id" IS NOT NULL`,
            ),
          )
          .orderBy(desc(oauthRefreshToken.createdAt)),
    )
    const authorizationCodeId = refreshRows.find(
      (r) => r.authorizationCodeId,
    )?.authorizationCodeId
    if (!authorizationCodeId) {
      return yield* Effect.fail(
        new AgentAccessConsentRejected({
          reason:
            "No active delegated session yet; finish OAuth token exchange first.",
        }),
      )
    }
    return yield* runQuery(DatabaseOperation.SubmitAgentAccessConsent, () =>
      db.transaction(async (tx) => {
        const now = new Date()
        if (
          priorAuthorizationCodeId &&
          priorAuthorizationCodeId !== authorizationCodeId
        ) {
          await revokeGrantFamilyInTransaction(tx, {
            now,
            userId: input.userId,
            clientId: input.clientId,
            authorizationCodeId: priorAuthorizationCodeId,
            markConsentIntentsRevoked: false,
          })
          await tx
            .update(agentAccessOauthConsentIntents)
            .set({ state: "superseded", updatedAt: now })
            .where(
              and(
                eq(agentAccessOauthConsentIntents.userId, input.userId),
                eq(agentAccessOauthConsentIntents.clientId, input.clientId),
                eq(
                  agentAccessOauthConsentIntents.authorizationCodeId,
                  priorAuthorizationCodeId,
                ),
              ),
            )
        }
        await tx
          .delete(agentAccessGrantProjects)
          .where(
            eq(
              agentAccessGrantProjects.authorizationCodeId,
              authorizationCodeId,
            ),
          )
        await tx.insert(agentAccessGrantProjects).values(
          uniqueProjects.map((projectId) => ({
            authorizationCodeId,
            projectId,
          })),
        )
        await tx
          .insert(agentAccessOauthConsentIntents)
          .values({
            userId: input.userId,
            clientId: input.clientId,
            oauthConsentId: input.oauthConsentId,
            authorizationCodeId,
            resourceUrl: input.resourceUrl,
            redirectUri: input.redirectUri,
            requestedScopes: [...input.requestedScopes],
            state: "completed",
          })
          .onConflictDoUpdate({
            target: agentAccessOauthConsentIntents.oauthConsentId,
            set: {
              authorizationCodeId,
              resourceUrl: input.resourceUrl,
              redirectUri: input.redirectUri,
              requestedScopes: [...input.requestedScopes],
              state: "completed",
              updatedAt: new Date(),
            },
          })
        return authorizationCodeId
      }),
    )
  },
)
