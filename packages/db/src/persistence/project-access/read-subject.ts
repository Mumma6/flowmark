import { Context, Effect, Match } from "effect"
import { sql } from "drizzle-orm"
import type { DatabaseTransaction } from "../run-transaction.js"
import { DatabaseError } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"

export type ProjectReadIdentity =
  | { readonly kind: "key"; readonly keyHash: string }
  | { readonly kind: "user"; readonly userId: string }
  | {
      readonly kind: "delegated"
      readonly userId: string
      readonly clientId: string
      readonly authorizationCodeId: string
    }
export const ProjectReadSubject = Context.Reference<
  ProjectReadIdentity | undefined
>("@flowmark/db/ProjectReadSubject", { defaultValue: () => undefined })

export const ProjectReadDepth = Context.Reference<"diagnostic" | "business">(
  "@flowmark/db/ProjectReadDepth",
  { defaultValue: () => "diagnostic" },
)

/** Lock current authority inside the project read fence, including delayed reads. */
export const assertProjectReadSubject = Effect.fn("assertProjectReadSubject")(
  function* (
    tx: DatabaseTransaction,
    projectId: string,
    subject: ProjectReadIdentity | undefined,
  ) {
    if (!subject) {
      return
    }
    const depth = yield* ProjectReadDepth
    const role =
      depth === "business" ? sql`true` : sql`m.role IN ('owner', 'viewer')`
    const query = Match.value(subject).pipe(
      Match.when(
        { kind: "key" },
        (subject) =>
          sql`SELECT k.id FROM project_api_keys k JOIN projects p ON p.id = k.project_id WHERE k.project_id = ${projectId}::uuid AND k.key_hash = ${subject.keyHash} AND k.permission = 'read' AND k.credential_epoch = p.credential_epoch FOR SHARE OF k`,
      ),
      Match.when(
        { kind: "user" },
        (subject) =>
          sql`SELECT m.user_id FROM project_members m JOIN "user" u ON u.id = m.user_id WHERE m.project_id = ${projectId}::uuid AND m.user_id = ${subject.userId} AND u.lifecycle_operation_id IS NULL AND ${role} FOR SHARE OF m`,
      ),
      Match.when(
        { kind: "delegated" },
        (subject) =>
          sql`SELECT m.user_id FROM project_members m JOIN "user" u ON u.id = m.user_id JOIN agent_access_grant_projects g ON g.project_id = m.project_id JOIN oauth_refresh_token r ON r.authorization_code_id = g.authorization_code_id WHERE m.project_id = ${projectId}::uuid AND m.user_id = ${subject.userId} AND u.lifecycle_operation_id IS NULL AND ${role} AND r.user_id = ${subject.userId} AND r.client_id = ${subject.clientId} AND r.authorization_code_id = ${subject.authorizationCodeId} AND r.revoked IS NULL AND (r.expires_at IS NULL OR r.expires_at > clock_timestamp()) FOR SHARE OF m, g, r`,
      ),
      Match.exhaustive,
    )
    const rows = yield* runQuery(DatabaseOperation.ProjectReadFence, () =>
      tx.execute(query),
    )
    if (!rows.length) {
      return yield* new DatabaseError({
        operation: DatabaseOperation.ProjectReadFence,
        cause: "Project read authority changed.",
      })
    }
  },
)
