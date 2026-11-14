import { eq, sql } from "drizzle-orm"
import { Array, Effect } from "effect"
import { projectMembers, projects, user } from "../../schema/index.js"
import type { DatabaseTransaction } from "../run-transaction.js"
import { runTransaction } from "../run-transaction.js"
import { Database } from "../database.js"
import { DatabaseOperation } from "../database-operation.js"
import { runQuery } from "../run-query.js"
import { SharingRejected } from "./types.js"

export const sharingQuery = <A>(use: () => Promise<A>) =>
  runQuery(DatabaseOperation.ProjectSharing, use)
/** User rows precede the project lock, matching account/email lifecycle admission. */
export const withSharingProject = Effect.fn("withSharingProject")(function* <
  A,
  E,
>(
  userId: string,
  projectId: string,
  use: (tx: DatabaseTransaction) => Effect.Effect<A, E>,
  recipientId?: string,
  allowInactiveRecipient = false,
) {
  const db = yield* Database
  return yield* runTransaction(
    DatabaseOperation.ProjectSharing,
    (f) => db.transaction(f),
    (tx) =>
      Effect.gen(function* () {
        yield* sharingQuery(() =>
          tx.execute(sql`SET LOCAL statement_timeout = '5s'`),
        )
        yield* sharingQuery(() =>
          tx.execute(sql`SET LOCAL lock_timeout = '3s'`),
        )
        const identities = yield* sharingQuery(() =>
          tx.execute<{ id: string; pending: string | null }>(
            sql`SELECT u.id, u.lifecycle_operation_id AS pending FROM "user" u WHERE u.id IN (${userId}, ${recipientId ?? null}) OR EXISTS (SELECT 1 FROM project_members m WHERE m.user_id = u.id AND m.project_id = ${projectId}::uuid AND m.role = 'owner') ORDER BY u.id FOR SHARE OF u`,
          ),
        )
        if (
          !Array.some(identities, (identity) => identity.id === userId) ||
          Array.some(
            identities,
            (identity) =>
              identity.pending !== null &&
              !(
                allowInactiveRecipient &&
                identity.id === recipientId &&
                identity.id !== userId
              ),
          )
        ) {
          return yield* new SharingRejected({ reason: "Unavailable" })
        }
        const [project] = yield* sharingQuery(() =>
          tx
            .select()
            .from(projects)
            .where(eq(projects.id, projectId))
            .for("update"),
        )
        if (!project || project.lifecycleOperationId !== null) {
          return yield* new SharingRejected({ reason: "Unavailable" })
        }
        return yield* use(tx)
      }),
  )
})
export const sharingOwner = Effect.fn("sharingOwner")(function* (
  tx: DatabaseTransaction,
  userId: string,
  projectId: string,
) {
  const rows = yield* sharingQuery(() =>
    tx
      .select({
        id: projectMembers.userId,
        name: user.name,
        email: user.email,
        verified: user.emailVerified,
      })
      .from(projectMembers)
      .innerJoin(user, eq(user.id, projectMembers.userId))
      .where(
        sql`${projectMembers.projectId} = ${projectId}::uuid AND ${projectMembers.role} = 'owner'`,
      ),
  )
  const owner = rows[0]
  if (rows.length !== 1 || owner.id !== userId) {
    return yield* new SharingRejected({ reason: "Unauthorized" })
  }
  return owner
})
