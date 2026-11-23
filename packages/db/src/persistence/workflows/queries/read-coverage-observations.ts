import {
  CoverageStoredEventSchema,
  type CoverageObservationQuery,
  type CoverageStoredEvent,
} from "@flowmarkdev/core"
import { Array, Effect, Option, Result, Schema } from "effect"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"
import {
  COVERAGE_OBSERVATION_CAP,
  coverageObservationSql,
} from "../sql/coverage-observations.js"

export const readCoverageObservations = Effect.fn("readCoverageObservations")(
  function* (projectId: string, query: CoverageObservationQuery) {
    const db = yield* Database
    const rows = yield* runQuery(
      DatabaseOperation.ReadCoverageObservations,
      () =>
        db.execute<CoverageStoredEvent>(
          coverageObservationSql(projectId, query),
        ),
    )
    const events = Array.getSomes(
      Array.map(Array.take(rows, COVERAGE_OBSERVATION_CAP), (row) =>
        Result.match(
          Schema.decodeUnknownResult(CoverageStoredEventSchema)(row),
          {
            onSuccess: Option.some,
            onFailure: () => Option.none(),
          },
        ),
      ),
    )
    return {
      events,
      truncated: rows.length > COVERAGE_OBSERVATION_CAP,
    }
  },
)
