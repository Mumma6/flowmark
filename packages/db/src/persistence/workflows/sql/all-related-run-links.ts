import { sql } from "drizzle-orm"
import { relatedRunsSql } from "./related-runs.js"
import { retryRunsSql } from "./retry-runs.js"

/** Flat, deterministically ordered explicit run links for bounded paging. */
export const allRelatedRunLinksSql = (projectId: string, runId: string) => sql`
  SELECT
    link.id,
    link."externalId",
    link.workflow,
    link."startedAt",
    link.status,
    link."correlationId",
    link."parentRunId",
    link.relationship
  FROM (
    SELECT
      r.id,
      r."externalId",
      r.workflow,
      r."startedAt",
      r.status,
      r."correlationId",
      r."parentRunId",
      r.relationship
    FROM (${relatedRunsSql(projectId, runId)}) r
    UNION ALL
    SELECT
      t.id,
      t."externalId",
      t.workflow,
      t."startedAt",
      t.status,
      t."correlationId",
      t."parentRunId",
      t.relationship
    FROM (${retryRunsSql(projectId, runId)}) t
  ) link
`
