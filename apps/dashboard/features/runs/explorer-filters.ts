import {
  Array as EffectArray,
  Data,
  Option,
  Result,
  Schema,
  pipe,
} from "effect"
import type { RouterInputs } from "../platform/api-types"

export const ExplorerFilters = Schema.Struct({
  expectationState: Schema.String,
  startedBeforeExact: Schema.String,
  ratioNumerator: Schema.String,
  ratioDenominator: Schema.String,
  definitionRevision: Schema.String,
  outcome: Schema.String,
  terminalOnly: Schema.String,
  startedAfterExact: Schema.String,
  startedBeforeExclusive: Schema.String,
  resultPath: Schema.String,
  resultOperator: Schema.String,
  resultValue: Schema.String,
  resultKind: Schema.String,
  resultReason: Schema.String,
  businessKey: Schema.String,
  businessValue: Schema.String,
  search: Schema.String,
  status: Schema.String,
  workflow: Schema.String,
  namespace: Schema.String,
  failCode: Schema.String,
  environment: Schema.String,
  release: Schema.String,
  startedAfter: Schema.String,
  startedBefore: Schema.String,
})
export type ExplorerFilters = typeof ExplorerFilters.Type

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

export const explorerFilterLabels: Record<keyof ExplorerFilters, string> = {
  expectationState: "Expectation state",
  startedBeforeExact: "Before (exact)",
  ratioNumerator: "Ratio numerator",
  ratioDenominator: "Ratio denominator",
  definitionRevision: "Definition",
  outcome: "Outcome",
  terminalOnly: "Finished only",
  startedAfterExact: "After (exact)",
  startedBeforeExclusive: "Before (exclusive)",
  resultPath: "Result path",
  resultOperator: "Result operator",
  resultValue: "Result value",
  resultKind: "Result type",
  resultReason: "Reason",
  businessKey: "Business field",
  businessValue: "Business value",
  search: "Search",
  workflow: "Workflow",
  status: "Status",
  namespace: "Namespace",
  failCode: "Failure code",
  environment: "Environment",
  release: "Release",
  startedAfter: "From",
  startedBefore: "Through",
}

const PathFromJson = Schema.fromJsonString(Schema.Array(Schema.String))
export class InvalidResultPath extends Data.TaggedError("InvalidResultPath")<{
  readonly operation: "decodeResultPath"
  readonly cause: unknown
}> {}

/** Keep the schema failure available to callers that need to explain a bad URL. */
export const decodeResultPath = (value: unknown) =>
  pipe(
    Schema.decodeUnknownResult(PathFromJson)(value),
    Result.mapError(
      (cause) =>
        new InvalidResultPath({ operation: "decodeResultPath", cause }),
    ),
  )

export const parseResultPath = (value: string) =>
  pipe(
    decodeResultPath(value),
    Result.match({
      onFailure: () => Option.none<string[]>(),
      onSuccess: Option.some,
    }),
  )

export function readExplorerFilters(
  params: Pick<URLSearchParams, "get">,
): ExplorerFilters {
  return Schema.decodeUnknownSync(ExplorerFilters)(
    Object.fromEntries(
      Object.entries(explorerDefaults).map(([key, fallback]) => [
        key,
        params.get(key) ?? fallback,
      ]),
    ),
  )
}

export function exploreHref(filters: ExplorerFilters) {
  const params = new URLSearchParams()
  EffectArray.forEach(
    EffectArray.fromIterable(Object.entries(explorerDefaults)),
    ([key, fallback]) => {
      const value = filters[key as keyof ExplorerFilters]
      if (value !== fallback) {
        params.set(key, value)
      }
    },
  )
  return `/${params.size ? `?${params}` : ""}`
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
