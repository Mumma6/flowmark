import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm"
import {
  Array as EffectArray,
  Effect,
  Option,
  Order,
  Result,
  pipe,
} from "effect"
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
  const normalize = (scopes: ReadonlyArray<string> | null | undefined) =>
    pipe(
      scopes ?? [],
      EffectArray.map((scope) => scope.trim()),
      EffectArray.filter((scope) => scope.length > 0),
      EffectArray.sort(Order.String),
    )
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
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
    yield* Effect.forEach(
      uniqueProjects,
      Effect.fn(function* (projectId) {
        const member = yield* getMemberProject(input.userId, projectId)
        if (!member) {
          return yield* new AgentAccessConsentRejected({
            reason: "One or more projects are not in this account.",
          })
        }
      }),
      { discard: true },
    )
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
    const authorizationCodeId = pipe(
      refreshRows,
      EffectArray.findFirst((row) => Boolean(row.authorizationCodeId)),
      Option.flatMap((row) => Option.fromNullishOr(row.authorizationCodeId)),
      Option.getOrUndefined,
    )
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
        const projectScope = sql.join(
          EffectArray.map(uniqueProjects, (id) => sql`${id}::uuid`),
          sql`, `,
        )
        // A stale approval must not recreate a removed membership's grant binding.
        await tx.execute(sql`SET LOCAL statement_timeout = '5s'`)
        await tx.execute(sql`SET LOCAL lock_timeout = '3s'`)
        const actors = await tx.execute<{ id: string; pending: string | null }>(
          sql`SELECT u.id, u.lifecycle_operation_id AS pending FROM "user" u WHERE u.id = ${input.userId} OR EXISTS (SELECT 1 FROM project_members m WHERE m.user_id = u.id AND m.role = 'owner' AND m.project_id IN (${projectScope})) ORDER BY u.id FOR SHARE OF u`,
        )
        if (
          !EffectArray.some(actors, (actor) => actor.id === input.userId) ||
          EffectArray.some(actors, (actor) => actor.pending !== null)
        ) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason: "Account access changed.",
            }),
          )
        }
        const liveProjects = await tx.execute(
          sql`SELECT id FROM projects WHERE id IN (${projectScope}) AND lifecycle_operation_id IS NULL ORDER BY id FOR SHARE`,
        )
        const liveMembers = await tx.execute(
          sql`SELECT project_id FROM project_members WHERE user_id = ${input.userId} AND project_id IN (${projectScope}) ORDER BY project_id FOR SHARE`,
        )
        if (
          liveProjects.length !== uniqueProjects.length ||
          liveMembers.length !== uniqueProjects.length
        ) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason: "Project access changed.",
            }),
          )
        }

        const now = new Date()
        // Serialize consent/revoke against this family and recheck liveness in
        // the transaction. Duplicate submissions may repeat, never widen, scope.
        const active = await tx
          .select({ id: oauthRefreshToken.id })
          .from(oauthRefreshToken)
          .where(
            and(
              eq(oauthRefreshToken.authorizationCodeId, authorizationCodeId),
              eq(oauthRefreshToken.userId, input.userId),
              eq(oauthRefreshToken.clientId, input.clientId),
              isNull(oauthRefreshToken.revoked),
              or(
                isNull(oauthRefreshToken.expiresAt),
                gt(oauthRefreshToken.expiresAt, now),
              ),
            ),
          )
          .for("update")
        if (active.length === 0) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason: "The delegated session is no longer active.",
            }),
          )
        }
        const bound = await tx
          .select({ projectId: agentAccessGrantProjects.projectId })
          .from(agentAccessGrantProjects)
          .where(
            eq(
              agentAccessGrantProjects.authorizationCodeId,
              authorizationCodeId,
            ),
          )
        if (
          bound.length > 0 &&
          !scopeSetsEqual(
            EffectArray.map(bound, (row) => row.projectId),
            uniqueProjects,
          )
        ) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason:
                "Project scope is immutable for this authorization. Reconnect before changing projects.",
            }),
          )
        }
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
          EffectArray.map(uniqueProjects, (projectId) => ({
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
        return Result.succeed(authorizationCodeId)
      }),
    ).pipe(Effect.flatMap(Effect.fromResult))
  },
)
