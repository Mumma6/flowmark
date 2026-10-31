import { sql, type SQL } from "drizzle-orm"
import type { ResultDeclaration, ResultSelection } from "@flowmarkdev/core"
export const resultValue = (
  path: readonly string[],
  source: SQL = sql`result`,
) =>
  sql`(${source} #> ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(path)}::jsonb)))`
export const validCount = (value: SQL) =>
  sql`CASE WHEN jsonb_typeof(${value}) = 'number' THEN (${value}::text)::numeric BETWEEN 0 AND 9007199254740991 AND trunc((${value}::text)::numeric) = (${value}::text)::numeric ELSE false END`
export const resultPredicate = (
  selection?: ResultSelection,
  declaration?: ResultDeclaration["fields"][number],
) => {
  if (!selection) {
    return sql`true`
  }
  const field = resultValue(selection.path)
  const value =
    selection.reason === undefined
      ? field
      : sql`(${field} -> ${selection.reason}::text)`
  const object = sql`CASE WHEN jsonb_typeof(${field}) = 'object' THEN ${field} ELSE '{}'::jsonb END`
  const coverage =
    selection.reason === undefined
      ? sql`true`
      : sql`jsonb_typeof(${field}) = 'object' AND NOT EXISTS (
    SELECT 1 FROM jsonb_each(${object}) item WHERE NOT (${validCount(sql`item.value`)}) OR NOT (${JSON.stringify(declaration?.values ?? [])}::jsonb ? item.key)
  )`
  const compare =
    typeof selection.value === "string"
      ? sql`jsonb_typeof(${value}) = 'string' AND ${value} = ${JSON.stringify(selection.value)}::jsonb`
      : sql`CASE WHEN ${validCount(value)} THEN (${value}::text)::numeric ${selection.operator === "gte" ? sql`>=` : selection.operator === "lte" ? sql`<=` : sql`=`} ${selection.value}::numeric ELSE false END`
  return sql`status <> 'Running' AND "definitionRevision" = ${selection.revision} AND (${coverage}) AND (${compare})`
}
