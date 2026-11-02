import { Array, Option, pipe } from "effect"
import type { RouterInputs, RouterOutputs } from "../../lib/api/types"
import { defaultIntelligenceQuery } from "../period/period"
import type { ResultDeclaration } from "./result-presentation"

type Params = Pick<URLSearchParams, "get" | "has">
export type BusinessWindow = { after: string; before: string; days: 7 | 30 }
export type EvidenceSelection = {
  outcome?: string
  ratio?: boolean
  resultSelection?: {
    value: string | number
    reason?: string
    operator: "eq" | "gte" | "lte"
  }
}

export function selectBusinessOutcomes(
  workflow: string,
  params: Params,
  declarations: readonly ResultDeclaration[],
  lockedWindow?: BusinessWindow,
) {
  const selectedRevision = pipe(
    Option.fromNullishOr(params.get("biRevision")),
    Option.orElse(() =>
      pipe(
        declarations,
        Array.findFirst((item) => item.fields.some((field) => field.aggregate)),
        Option.map((item) => item.revision),
      ),
    ),
    Option.getOrElse(() => ""),
  )
  const declaration = pipe(
    declarations,
    Array.findFirst((item) => item.revision === selectedRevision),
    Option.getOrUndefined,
  )
  const hasAggregatableField =
    declarations.some((item) => item.fields.some((entry) => entry.aggregate)) ??
    false
  const fields = declaration?.fields.filter((field) => field.aggregate) ?? []
  const field = pipe(
    params.has("biPath")
      ? Array.findFirst(
          fields,
          (item) => JSON.stringify(item.path) === params.get("biPath"),
        )
      : Array.head(fields),
    Option.getOrUndefined,
  )
  const defaults = defaultIntelligenceQuery(workflow)
  const after =
    lockedWindow?.after ??
    params.get("biAfter") ??
    defaults.currentStartedAfter.slice(0, 10)
  const before =
    lockedWindow?.before ??
    params.get("biBefore") ??
    defaults.currentStartedBefore.slice(0, 10)
  const currentStartedAfter = `${after}T00:00:00.000Z`
  const currentStartedBefore = `${before}T00:00:00.000Z`
  const duration =
    Date.parse(currentStartedBefore) - Date.parse(currentStartedAfter)
  const validDates =
    Number.isFinite(duration) && duration > 0 && duration <= 31 * 86400000
  const countFields = fields.filter((item) => item.kind === "count")
  const numerator = countFields.find(
    (item) => JSON.stringify(item.path) === params.get("biNumerator"),
  )?.path
  const denominator = countFields.find(
    (item) => JSON.stringify(item.path) === params.get("biDenominator"),
  )?.path
  const input: RouterInputs["project"]["businessInsights"] = {
    workflow,
    revision: selectedRevision,
    path: field?.path ?? [],
    currentStartedAfter,
    currentStartedBefore,
    previousStartedAfter: validDates
      ? new Date(Date.parse(currentStartedAfter) - duration).toISOString()
      : currentStartedAfter,
    previousStartedBefore: currentStartedAfter,
    ...(params.get("biDimension")
      ? {
          businessKey: params.get("biDimension") ?? "",
          businessValue: params.get("biDimensionValue") ?? "",
        }
      : {}),
    ...(params.get("biNumerator") ? { numerator: numerator ?? [] } : {}),
    ...(params.get("biDenominator") ? { denominator: denominator ?? [] } : {}),
    ...(params.get("biReleaseA") || params.get("biReleaseB")
      ? {
          releaseA: params.get("biReleaseA") || undefined,
          releaseB: params.get("biReleaseB") || undefined,
        }
      : {}),
  }
  return {
    selectedRevision,
    hasAggregatableField,
    fields,
    field,
    after,
    before,
    validDates,
    input,
  }
}

export function businessEvidencePath(
  model: ReturnType<typeof selectBusinessOutcomes>,
  window: RouterOutputs["project"]["businessInsights"]["windows"][number],
  selection?: EvidenceSelection,
) {
  const { input, selectedRevision, field } = model
  const { workflow, currentStartedAfter, currentStartedBefore } = input
  const query = new URLSearchParams({
    workflow,
    terminalOnly: "true",
    startedAfterExact:
      window.scope === "previous"
        ? input.previousStartedAfter
        : currentStartedAfter,
    startedBeforeExclusive:
      window.scope === "previous"
        ? input.previousStartedBefore
        : currentStartedBefore,
  })
  if (input.businessKey) {
    query.set("businessKey", input.businessKey)
    query.set("businessValue", input.businessValue ?? "")
  }
  if (window.scope === "releaseA") {
    query.set("release", input.releaseA ?? "")
  }
  if (window.scope === "releaseB") {
    query.set("release", input.releaseB ?? "")
  }
  if (selection?.outcome) {
    query.set("outcome", selection.outcome)
  }
  if (selection?.ratio && input.numerator && input.denominator) {
    query.set("definitionRevision", selectedRevision)
    query.set("ratioNumerator", JSON.stringify(input.numerator))
    query.set("ratioDenominator", JSON.stringify(input.denominator))
  }
  if (selection?.resultSelection) {
    query.set("definitionRevision", selectedRevision)
    query.set("resultPath", JSON.stringify(field?.path))
    query.set("resultOperator", selection.resultSelection.operator)
    query.set("resultValue", String(selection.resultSelection.value))
    query.set(
      "resultKind",
      typeof selection.resultSelection.value === "number"
        ? "count"
        : "category",
    )
    if (selection.resultSelection.reason) {
      query.set("resultReason", selection.resultSelection.reason)
    }
  }
  return `/runs?${query}`
}
