import { SearchFieldsSchema, type SearchFields } from "@flowmarkdev/core"
import { sql } from "drizzle-orm"
import { Effect, Match, Result, Schema } from "effect"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { getSearchFieldConfiguration } from "../../result-declarations/queries/get-search-fields.js"
import { boundJsonPreview } from "../bounded-record-preview.js"
import {
  BOUNDED_RECORD_PREVIEW_MAX_BYTES,
  resolveBoundedSectionLimit,
} from "../bounded-read-limits.js"
import {
  encodeRevisionDiscoveryCursor,
  scopeRevisionDiscoveryCursor,
} from "../workflow-discovery-cursor.js"
import {
  WORKFLOW_DISCOVERY_CAPABILITIES,
  type WorkflowMeaningPage,
  type WorkflowMeaningQuery,
} from "../types.js"

const createdAtText = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString()

const keysFor = (fields: SearchFields, role: "lookup" | "dimension") =>
  fields.flatMap((field) => (field.role === role ? [field.key] : []))

export const getWorkflowMeaningPage = Effect.fn("getWorkflowMeaningPage")(
  function* (projectId: string, query: WorkflowMeaningQuery) {
    if (query.workflow.trim().length === 0 || query.workflow.length > 200) {
      return yield* new InvalidResultQuery({
        message: "Invalid workflow discovery scope.",
      })
    }
    if (
      query.revision !== undefined &&
      (query.revision.length === 0 || query.revision.length > 64)
    ) {
      return yield* new InvalidResultQuery({
        message: "Invalid workflow discovery scope.",
      })
    }
    const limit = resolveBoundedSectionLimit(query.limit)
    if (limit === null) {
      return yield* new InvalidResultQuery({
        message: "Invalid workflow discovery limit.",
      })
    }
    const scoped = scopeRevisionDiscoveryCursor(query.cursor, {
      projectId,
      workflow: query.workflow,
    })
    const cursor = yield* Match.value(scoped).pipe(
      Match.tag("Start", () =>
        Effect.succeed<{ createdAt: string; id: string } | null>(null),
      ),
      Match.tag("Continue", (value) =>
        Effect.succeed<{ createdAt: string; id: string } | null>(value),
      ),
      Match.tag("Invalid", () =>
        Effect.fail(
          new InvalidResultQuery({
            message: "Invalid workflow discovery cursor.",
          }),
        ),
      ),
      Match.exhaustive,
    )
    const db = yield* Database
    const revision = query.revision ?? null
    const [countRow] = yield* runQuery(
      DatabaseOperation.ReadDeclarationDiscovery,
      () =>
        db.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count
          FROM workflow_result_declarations
          WHERE project_id = ${projectId}::uuid
            AND workflow = ${query.workflow}
            AND (${revision}::text IS NULL OR revision = ${revision})
        `),
    )
    const rows = yield* runQuery(
      DatabaseOperation.ReadDeclarationDiscovery,
      () =>
        db.execute<{
          id: string
          revision: string
          declaration: unknown
          source: string | null
          createdAt: Date | string
        }>(sql`
          SELECT
            id,
            revision,
            declaration,
            source,
            created_at AS "createdAt"
          FROM workflow_result_declarations
          WHERE project_id = ${projectId}::uuid
            AND workflow = ${query.workflow}
            AND (${revision}::text IS NULL OR revision = ${revision})
            AND (
              ${cursor?.createdAt ?? null}::timestamptz IS NULL
              OR (created_at, id) > (
                ${cursor?.createdAt ?? null}::timestamptz,
                ${cursor?.id ?? null}::uuid
              )
            )
          ORDER BY created_at, id
          LIMIT ${limit + 1}
        `),
    )
    const configuration = yield* getSearchFieldConfiguration(
      projectId,
      query.workflow,
    )
    const storedFields = configuration.fields
    const searchFields = yield* Result.match(
      Schema.decodeUnknownResult(SearchFieldsSchema)(storedFields),
      {
        onFailure: () =>
          Effect.fail(
            new InvalidResultQuery({
              message: "Search field configuration is unreadable.",
            }),
          ),
        onSuccess: (fields) => Effect.succeed(fields),
      },
    )
    const pageRows = Array.from(rows)
    const hasMore = pageRows.length > limit
    const visible = hasMore ? pageRows.slice(0, limit) : pageRows
    const decoded = visible.map((row) => {
      const preview = boundJsonPreview(
        row.declaration,
        BOUNDED_RECORD_PREVIEW_MAX_BYTES,
        `Declaration payload exceeds the ${BOUNDED_RECORD_PREVIEW_MAX_BYTES}-byte bounded preview limit.`,
      )
      return {
        id: row.id,
        createdAt: createdAtText(row.createdAt),
        revision: row.revision,
        source: row.source,
        declaration: preview.value,
        truncated: preview.truncated,
        omissions: preview.omissions,
      }
    })
    const last = decoded.at(-1)
    const truncatedRecords = decoded.reduce(
      (count, row) => count + (row.truncated ? 1 : 0),
      0,
    )
    return {
      workflow: query.workflow,
      revisions: decoded.map(
        ({ revision: name, source, declaration, truncated, omissions }) => ({
          revision: name,
          source,
          declaration,
          truncated,
          omissions,
        }),
      ),
      searchFields,
      searchSources: configuration.sources,
      lookupKeys: keysFor(searchFields, "lookup"),
      dimensionKeys: keysFor(searchFields, "dimension"),
      nextCursor:
        hasMore && last
          ? encodeRevisionDiscoveryCursor({
              projectId,
              workflow: query.workflow,
              createdAt: last.createdAt,
              id: last.id,
            })
          : null,
      limit,
      totalRevisions: Number(countRow?.count ?? 0),
      applied: {
        projectId,
        workflow: query.workflow,
        revision: query.revision ?? null,
        cursor: query.cursor ?? null,
        limit,
      },
      omissions: {
        continued: hasMore,
        truncatedRecords,
      },
      capabilities: WORKFLOW_DISCOVERY_CAPABILITIES,
    } satisfies WorkflowMeaningPage
  },
)
