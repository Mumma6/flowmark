import { activeProjectOwners } from "../../account-lifecycle/active-account.js"
import { sql, and, eq, gt, isNull, or } from "drizzle-orm"
import { Effect } from "effect"
import {
  agentAccessGrantProjects,
  oauthRefreshToken,
  projectMembers,
  projects,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

/** Effective read = grant project allowlist ∩ current membership ∩ active refresh family row. */
export const getDelegatedReaderProject = Effect.fn("getDelegatedReaderProject")(
  function* (input: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly projectId: string
  }) {
    const db = yield* Database
    const rows = yield* runQuery(
      DatabaseOperation.GetDelegatedReaderProject,
      () =>
        db
          .select({ projectId: agentAccessGrantProjects.projectId })
          .from(agentAccessGrantProjects)
          .innerJoin(
            projects,
            eq(projects.id, agentAccessGrantProjects.projectId),
          )
          .innerJoin(
            oauthRefreshToken,
            eq(
              oauthRefreshToken.authorizationCodeId,
              agentAccessGrantProjects.authorizationCodeId,
            ),
          )
          .innerJoin(
            projectMembers,
            and(
              eq(projectMembers.projectId, agentAccessGrantProjects.projectId),
              eq(projectMembers.userId, input.userId),
            ),
          )
          .where(
            and(
              eq(oauthRefreshToken.userId, input.userId),
              isNull(projects.lifecycleOperationId),
              activeProjectOwners(sql`${projects.id}`),
              eq(oauthRefreshToken.clientId, input.clientId),
              isNull(oauthRefreshToken.revoked),
              or(
                isNull(oauthRefreshToken.expiresAt),
                gt(oauthRefreshToken.expiresAt, new Date()),
              ),
              eq(
                oauthRefreshToken.authorizationCodeId,
                input.authorizationCodeId,
              ),
              eq(agentAccessGrantProjects.projectId, input.projectId),
            ),
          )
          .limit(1),
    )
    return rows[0]?.projectId
  },
)
