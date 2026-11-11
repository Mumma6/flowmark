import { Match } from "effect"
import type { ExplorerFilters } from "./explorer-filters"

export const selectRunFilterGroup = (filters: ExplorerFilters) =>
  Match.value(filters).pipe(
    Match.when(
      (value) => Boolean(value.businessKey || value.businessValue),
      () => "business",
    ),
    Match.when(
      (value) =>
        Boolean(
          value.outcome ||
          value.definitionRevision ||
          value.resultPath ||
          value.ratioNumerator ||
          value.ratioDenominator,
        ),
      () => "results",
    ),
    Match.when(
      (value) =>
        Boolean(
          value.failCode ||
          value.environment ||
          value.release ||
          value.namespace !== "all",
        ),
      () => "technical",
    ),
    Match.orElse(() => "execution"),
  )
