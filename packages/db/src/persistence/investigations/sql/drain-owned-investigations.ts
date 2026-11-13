import { sql } from "drizzle-orm"
/** Reuse the persisted saved-question phase; never renumber in-flight cleanup. */
export const drainOwnedInvestigations = (
  scope: { readonly userId: string } | { readonly projectId: string },
) => {
  const shared =
    "userId" in scope
      ? sql`creator_id=${scope.userId}`
      : sql`project_id=${scope.projectId}::uuid`
  const personal =
    "userId" in scope
      ? sql`owner_id=${scope.userId}`
      : sql`project_id=${scope.projectId}::uuid`
  return sql`WITH shared AS (
    DELETE FROM shared_investigations WHERE id IN (SELECT id FROM shared_investigations WHERE ${shared} LIMIT 25) RETURNING id
  ), personal AS (
    DELETE FROM saved_investigations WHERE id IN (SELECT id FROM saved_investigations WHERE ${personal} LIMIT 75) RETURNING id
  ) SELECT id FROM shared UNION ALL SELECT id FROM personal`
}
