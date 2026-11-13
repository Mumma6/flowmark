import { and, eq, gt, inArray, arrayContains, sql } from "drizzle-orm"
import { Array, Effect, Result } from "effect"
import {
  agentAccessGrantProjects,
  agentAccessOauthConsentIntents,
  oauthConsent,
  projectMembers,
  verification,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { revokeGrantFamilyInTransaction } from "./revoke-grant-family-in-transaction.js"
import { AgentAccessConsentRejected } from "../agent-access-errors.js"

export interface AgentConsentCodeBinding {
  readonly userId: string
  readonly sessionId: string
  readonly clientId: string
  readonly resourceUrl: string
  readonly redirectUri: string
  readonly authorizationCodeId: string
  readonly projectIds: readonly string[]
}

/** Bind the actual provider-issued, unconsumed code before it leaves the server. */
export const bindAgentConsentCode = Effect.fn("bindAgentConsentCode")(
  function* (input: AgentConsentCodeBinding) {
    if (
      input.projectIds.length < 1 ||
      input.projectIds.length > 10 ||
      Array.dedupe(input.projectIds).length !== input.projectIds.length
    ) {
      return yield* new AgentAccessConsentRejected({
        reason: "Select between one and ten distinct projects.",
      })
    }
    const db = yield* Database
    return yield* runQuery(DatabaseOperation.BindAgentConsentCode, () =>
      db.transaction(async (tx) => {
        const projectScope = sql.join(
          Array.map(input.projectIds, (id) => sql`${id}::uuid`),
          sql`, `,
        )
        await tx.execute(sql`SET LOCAL statement_timeout = '5s'`)
        await tx.execute(sql`SET LOCAL lock_timeout = '3s'`)
        const actors = await tx.execute<{ id: string; pending: string | null }>(
          sql`SELECT u.id, u.lifecycle_operation_id AS pending FROM "user" u WHERE u.id = ${input.userId} OR EXISTS (SELECT 1 FROM project_members m WHERE m.user_id = u.id AND m.role = 'owner' AND m.project_id IN (${projectScope})) ORDER BY u.id FOR SHARE OF u`,
        )
        const liveProjects = await tx.execute(
          sql`SELECT id FROM projects WHERE id IN (${projectScope}) AND lifecycle_operation_id IS NULL ORDER BY id FOR SHARE`,
        )
        const liveMembers = await tx.execute(
          sql`SELECT project_id FROM project_members WHERE user_id = ${input.userId} AND project_id IN (${projectScope}) ORDER BY project_id FOR SHARE`,
        )
        if (
          !Array.some(actors, (actor) => actor.id === input.userId) ||
          Array.some(actors, (actor) => actor.pending !== null) ||
          liveProjects.length !== input.projectIds.length ||
          liveMembers.length !== input.projectIds.length
        ) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason: "Project access changed.",
            }),
          )
        }
        const [code] = await tx
          .select({ id: verification.id })
          .from(verification)
          .where(
            and(
              eq(verification.identifier, input.authorizationCodeId),
              gt(verification.expiresAt, new Date()),
              sql`${verification.value}::jsonb->>'type' = 'authorization_code'`,
              sql`${verification.value}::jsonb->>'userId' = ${input.userId}`,
              sql`${verification.value}::jsonb->>'sessionId' = ${input.sessionId}`,
              sql`${verification.value}::jsonb->'query'->>'client_id' = ${input.clientId}`,
              sql`${verification.value}::jsonb->'query'->>'redirect_uri' = ${input.redirectUri}`,
              sql`(${verification.value}::jsonb->'resource') = ${JSON.stringify([input.resourceUrl])}::jsonb`,
            ),
          )
          .for("update")
          .limit(1)
        if (!code) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason:
                "The authorization transaction is stale or belongs to another account.",
            }),
          )
        }
        // Serialize authorization versions using the canonical provider consent.
        const [consent] = await tx
          .select({ id: oauthConsent.id, scopes: oauthConsent.scopes })
          .from(oauthConsent)
          .where(
            and(
              eq(oauthConsent.userId, input.userId),
              eq(oauthConsent.clientId, input.clientId),
              arrayContains(oauthConsent.resources, [input.resourceUrl]),
            ),
          )
          .for("update")
          .limit(1)
        if (!consent) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason: "The provider consent is no longer available.",
            }),
          )
        }
        const members = await tx
          .select({ projectId: projectMembers.projectId })
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.userId, input.userId),
              inArray(projectMembers.projectId, [...input.projectIds]),
            ),
          )
        if (members.length !== input.projectIds.length) {
          return Result.fail(
            new AgentAccessConsentRejected({
              reason: "One or more projects are not available to this account.",
            }),
          )
        }
        const bound = await tx
          .select({ projectId: agentAccessGrantProjects.projectId })
          .from(agentAccessGrantProjects)
          .where(
            eq(
              agentAccessGrantProjects.authorizationCodeId,
              input.authorizationCodeId,
            ),
          )
        if (bound.length > 0) {
          const same =
            bound.length === input.projectIds.length &&
            Array.every(bound, (row) =>
              input.projectIds.includes(row.projectId),
            )
          return same
            ? Result.succeed(undefined)
            : Result.fail(
                new AgentAccessConsentRejected({
                  reason:
                    "The authorization already has a different immutable project selection.",
                }),
              )
        }
        const [prior] = await tx
          .select({
            authorizationCodeId:
              agentAccessOauthConsentIntents.authorizationCodeId,
          })
          .from(agentAccessOauthConsentIntents)
          .where(eq(agentAccessOauthConsentIntents.oauthConsentId, consent.id))
          .limit(1)
        if (prior && prior.authorizationCodeId !== input.authorizationCodeId) {
          await tx
            .delete(verification)
            .where(eq(verification.identifier, prior.authorizationCodeId))
          await revokeGrantFamilyInTransaction(tx, {
            now: new Date(),
            userId: input.userId,
            clientId: input.clientId,
            authorizationCodeId: prior.authorizationCodeId,
            markConsentIntentsRevoked: false,
          })
        }
        await tx.insert(agentAccessGrantProjects).values(
          Array.map(input.projectIds, (projectId) => ({
            authorizationCodeId: input.authorizationCodeId,
            projectId,
          })),
        )
        await tx
          .insert(agentAccessOauthConsentIntents)
          .values({
            userId: input.userId,
            clientId: input.clientId,
            oauthConsentId: consent.id,
            authorizationCodeId: input.authorizationCodeId,
            resourceUrl: input.resourceUrl,
            redirectUri: input.redirectUri,
            requestedScopes: consent.scopes,
            state: "completed",
          })
          .onConflictDoUpdate({
            target: agentAccessOauthConsentIntents.oauthConsentId,
            set: {
              authorizationCodeId: input.authorizationCodeId,
              resourceUrl: input.resourceUrl,
              redirectUri: input.redirectUri,
              requestedScopes: consent.scopes,
              state: "completed",
              updatedAt: new Date(),
            },
          })
        return Result.succeed(undefined)
      }),
    ).pipe(Effect.flatMap(Effect.fromResult))
  },
)
