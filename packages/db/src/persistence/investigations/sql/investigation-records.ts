import { sql, and, eq } from "drizzle-orm"
import { savedInvestigations } from "../../../schema/index.js"
export const investigationScope = (userId: string, projectId: string) =>
  and(
    eq(savedInvestigations.ownerId, userId),
    eq(savedInvestigations.projectId, projectId),
  )
export const investigationColumns = {
  id: savedInvestigations.id,
  title: savedInvestigations.title,
  selection: savedInvestigations.selection,
  createdAt: sql<string>`to_char(${savedInvestigations.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
}
