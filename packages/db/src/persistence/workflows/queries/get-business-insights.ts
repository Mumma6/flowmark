import { Effect } from "effect"
import {
  BusinessInsightsQuerySchema,
  type BusinessInsights,
  type BusinessInsightsQuery,
  type BusinessWindow,
} from "@flowmarkdev/core"
import { Schema } from "effect"
import { Database, InvalidResultQuery } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import { getSearchFields } from "../../result-declarations/queries/get-search-fields.js"
import { declaredResultField } from "./validate-result-query.js"
import { businessInsightsSql } from "../sql/business-insights.js"

export const getBusinessInsights = Effect.fn("getBusinessInsights")(function* (
  projectId: string,
  input: BusinessInsightsQuery,
) {
  const query = yield* Schema.decodeUnknownEffect(BusinessInsightsQuerySchema)(
    input,
  ).pipe(
    Effect.mapError(
      () =>
        new InvalidResultQuery({
          message: "Invalid business insight interval or selection.",
        }),
    ),
  )
  const field = yield* declaredResultField(
    projectId,
    query.workflow,
    query.revision,
    query.path,
  )
  if (!field.aggregate) {
    return yield* new InvalidResultQuery({
      message: "This result field is not declared aggregatable.",
    })
  }
  for (const path of [query.numerator, query.denominator]) {
    if (!path) {
      continue
    }
    const count = yield* declaredResultField(
      projectId,
      query.workflow,
      query.revision,
      path,
    )
    if (!count.aggregate || count.kind !== "count") {
      return yield* new InvalidResultQuery({
        message: "Ratios require declared aggregatable count fields.",
      })
    }
  }
  if (query.businessKey !== undefined) {
    const dimensions = yield* getSearchFields(projectId, query.workflow)
    if (
      !dimensions.some(
        (entry) =>
          entry.role === "dimension" &&
          entry.key === query.businessKey &&
          entry.values.includes(query.businessValue ?? ""),
      )
    ) {
      return yield* new InvalidResultQuery({
        message: "Select a configured dimension value.",
      })
    }
  }
  const db = yield* Database
  const rows = yield* runQuery(DatabaseOperation.ReadBusinessInsights, () =>
    db.execute<{ data: BusinessWindow }>(
      businessInsightsSql(projectId, query, field),
    ),
  )
  const windows = Array.from(rows, (row) => row.data)
  const releases = windows.filter(
    (window) => window.scope === "releaseA" || window.scope === "releaseB",
  )
  const minimumRuns = 5
  const reason =
    releases.length !== 2
      ? "Select two distinct releases."
      : releases.some((window) => window.incompatibleRevision > 0)
        ? "Release cohorts contain missing or incompatible definition revisions."
        : releases.some(
              (window) =>
                window.knownRuns < minimumRuns ||
                (query.numerator !== undefined &&
                  window.ratio.knownRuns < minimumRuns),
            )
          ? "Each release needs at least five known result observations."
          : null
  return {
    query,
    field,
    windows,
    releaseComparison: { available: reason === null, reason, minimumRuns },
  } satisfies BusinessInsights
})
