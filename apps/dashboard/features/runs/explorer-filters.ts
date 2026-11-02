import { Option, Result, Schema, pipe } from "effect"
import type { RouterInputs } from "../../lib/api/types"

export type ExplorerFilters = {
  expectationState: string
  startedBeforeExact: string
  ratioNumerator: string
  ratioDenominator: string
  definitionRevision: string
  outcome: string
  terminalOnly: string
  startedAfterExact: string
  startedBeforeExclusive: string
  resultPath: string
  resultOperator: string
  resultValue: string
  resultKind: string
  resultReason: string

  businessKey: string
  businessValue: string
  search: string
  status: string
  workflow: string
  namespace: string
  failCode: string
  environment: string
  release: string
  startedAfter: string
  startedBefore: string
}

export const explorerDefaults: ExplorerFilters = {
  expectationState: "all",
  startedBeforeExact: "",
  ratioNumerator: "",
  ratioDenominator: "",
  definitionRevision: "",
  outcome: "",
  terminalOnly: "",
  startedAfterExact: "",
  startedBeforeExclusive: "",
  resultPath: "",
  resultOperator: "",
  resultValue: "",
  resultKind: "",
  resultReason: "",

  businessKey: "",
  businessValue: "",
  search: "",
  status: "all",
  workflow: "all",
  namespace: "all",
  failCode: "",
  environment: "",
  release: "",
  startedAfter: "",
  startedBefore: "",
}

const PathFromJson = Schema.fromJsonString(Schema.Array(Schema.String))
export const parseResultPath = (value: string) =>
  pipe(
    Schema.decodeUnknownResult(PathFromJson)(value),
    Result.match({
      onFailure: () => Option.none<string[]>(),
      onSuccess: Option.some,
    }),
  )

export function readExplorerFilters(
  params: Pick<URLSearchParams, "get">,
): ExplorerFilters {
  return Object.fromEntries(
    Object.entries(explorerDefaults).map(([key, fallback]) => [
      key,
      params.get(key) ?? fallback,
    ]),
  ) as ExplorerFilters
}

/** Invalid selections remain invalid inputs for API validation, never a broader query. */
export function buildRunListInput(
  filters: ExplorerFilters,
  workflow?: string,
  cursor?: string | null,
): RouterInputs["run"]["list"] {
  const selectedWorkflow =
    workflow ?? (filters.workflow !== "all" ? filters.workflow : "")
  const resultPath = Option.getOrUndefined(parseResultPath(filters.resultPath))
  const parseRatioPath = (value: string) =>
    pipe(
      parseResultPath(value),
      Option.getOrElse(() => []),
    )
  return {
    workflow:
      workflow ?? (filters.workflow !== "all" ? filters.workflow : undefined),
    businessKey:
      selectedWorkflow && filters.businessKey && filters.businessValue
        ? filters.businessKey
        : undefined,
    businessValue:
      selectedWorkflow && filters.businessKey && filters.businessValue
        ? filters.businessValue
        : undefined,
    status:
      filters.status === "all"
        ? undefined
        : (filters.status as "Completed" | "Failed" | "Running"),
    search: filters.search.trim() || undefined,
    failCode: filters.failCode.trim() || undefined,
    environment: filters.environment.trim() || undefined,
    release: filters.release.trim() || undefined,
    outcome: filters.outcome || undefined,
    ...(filters.ratioNumerator || filters.ratioDenominator
      ? {
          ratioSelection: {
            revision: filters.definitionRevision,
            numerator: parseRatioPath(filters.ratioNumerator),
            denominator: parseRatioPath(filters.ratioDenominator),
          },
        }
      : {}),
    definitionRevision: filters.definitionRevision || undefined,
    terminalOnly: filters.terminalOnly === "true" || undefined,
    startedBeforeExclusive: filters.startedBeforeExclusive || undefined,
    ...(filters.resultPath
      ? {
          resultSelection: {
            revision: filters.definitionRevision,
            path: resultPath ?? [],
            operator: (filters.resultOperator || "eq") as "eq" | "gte" | "lte",
            value:
              filters.resultKind === "category"
                ? filters.resultValue
                : filters.resultValue.trim()
                  ? Number(filters.resultValue)
                  : Number.NaN,
            ...(filters.resultReason ? { reason: filters.resultReason } : {}),
          },
        }
      : {}),
    namespace:
      filters.namespace === "browser"
        ? ("browser" as const)
        : filters.namespace === "server"
          ? ("application" as const)
          : undefined,
    expectationState: (
      ["pending", "overdue", "met-on-time", "met-late", "cancelled"] as const
    ).find((state) => state === filters.expectationState),
    startedAfter:
      filters.startedAfterExact ||
      (filters.startedAfter
        ? `${filters.startedAfter}T00:00:00.000Z`
        : undefined),
    startedBefore:
      filters.startedBeforeExact ||
      (filters.startedBefore
        ? `${filters.startedBefore}T23:59:59.999Z`
        : undefined),
    cursor: cursor ?? undefined,
    limit: 25,
  }
}
