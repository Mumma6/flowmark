import {
  ExpectationIdentifierSchema,
  ProcessHealthQuerySchema,
} from "@flowmarkdev/core"
import { Array, Result, Schema } from "effect"
import {
  explorerDefaults,
  explorerFilterLabels,
  type ExplorerFilters,
} from "../runs/explorer/explorer-filters"
import { periodDays, periodWindow } from "../period/period"

export const healthExpectationQueryKey = "healthExpectation"
export const healthPeriodQueryKey = "healthDays"

const supportedFilters = new Set<keyof ExplorerFilters>([
  "workflow",
  "startedAfterExact",
  "startedBeforeExclusive",
  "startedAfter",
])

const hasRunWindow = (filters: ExplorerFilters) =>
  Boolean(
    filters.startedAfterExact ||
    filters.startedBeforeExclusive ||
    filters.startedAfter ||
    filters.startedBefore,
  )

export function processHealthSelection(
  filters: ExplorerFilters,
  name: string,
  days: string | null,
  now: Date,
) {
  const unsupported = Array.filterMap(
    Object.keys(explorerDefaults) as (keyof ExplorerFilters)[],
    (key) =>
      filters[key] !== explorerDefaults[key] && !supportedFilters.has(key)
        ? Result.succeed(explorerFilterLabels[key])
        : Result.fail(undefined),
  )
  const period = periodWindow(periodDays(days), now)
  const explicitWindow = hasRunWindow(filters)
  const runWindow = {
    startedAfter:
      filters.startedAfterExact ||
      (filters.startedAfter ? `${filters.startedAfter}T00:00:00.000Z` : ""),
    startedBefore: filters.startedBeforeExclusive,
  }
  const input = {
    workflow: filters.workflow,
    expectationName: name,
    window: explicitWindow
      ? runWindow
      : {
          startedAfter: period.currentStartedAfter,
          startedBefore: period.currentStartedBefore,
        },
    ...(explicitWindow
      ? {}
      : {
          baseline: {
            startedAfter: period.previousStartedAfter,
            startedBefore: period.previousStartedBefore,
          },
        }),
  }

  if (unsupported.length) {
    return { kind: "unsupported" as const, filters: unsupported }
  }
  if (
    !Schema.is(ProcessHealthQuerySchema)({
      ...input,
      expectationName: "validation",
    })
  ) {
    return { kind: "unavailable-window" as const }
  }
  if (!Schema.is(ExpectationIdentifierSchema)(name)) {
    return { kind: "unmeasured" as const, explicitWindow, input }
  }
  return { kind: "selected" as const, explicitWindow, input }
}
