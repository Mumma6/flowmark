import { Effect } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  searchBusinessReferencesSql,
  searchWorkflowNamesSql,
} from "../sql/project-search.js"
import type {
  ProjectSearch,
  ProjectSearchReference,
  ProjectSearchWorkflow,
} from "../types.js"
import { listRuns } from "./list-runs.js"

const RESULT_LIMIT = 5

const empty = {
  workflows: [],
  runs: [],
  references: [],
} satisfies ProjectSearch

function likePattern(value: string) {
  return `%${value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`
}

export const searchProject = Effect.fn("searchProject")(function* (
  projectId: string,
  query: string,
) {
  const text = query.trim().slice(0, 200)
  if (text.length === 0) {
    return empty
  }
  const db = yield* Database
  const pattern = likePattern(text)
  const [workflows, page, references] = yield* Effect.all(
    [
      runQuery(DatabaseOperation.SearchWorkflowNames, () =>
        db.execute<ProjectSearchWorkflow>(
          searchWorkflowNamesSql(projectId, pattern, RESULT_LIMIT),
        ),
      ),
      listRuns(projectId, { search: text, limit: RESULT_LIMIT }),
      runQuery(DatabaseOperation.SearchBusinessReferences, () =>
        db.execute<ProjectSearchReference>(
          searchBusinessReferencesSql(projectId, text, RESULT_LIMIT),
        ),
      ),
    ],
    { concurrency: 3 },
  )
  return {
    workflows: Array.from(workflows),
    runs: page.runs.map((run) => ({
      id: run.id,
      externalId: run.externalId,
      workflow: run.workflow,
      status: run.status,
      startedAt: run.startedAt,
      failCode: run.failCode ?? null,
    })),
    references: Array.from(references),
  } satisfies ProjectSearch
})
