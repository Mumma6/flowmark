import { Array, Result, Schema } from "effect"
import {
  BusinessEvidenceQuerySchema,
  SavedSelectionSchema,
  type BusinessEvidenceQuery,
} from "@flowmarkdev/core"
const decode = Schema.decodeUnknownResult(BusinessEvidenceQuerySchema, {
  onExcessProperty: "error",
})
export const readBusinessLocation = (
  projectId: string,
  pathname: string,
  params: Pick<URLSearchParams, "get" | "has" | "keys">,
): BusinessEvidenceQuery | null => {
  if (
    Array.some(
      Array.fromIterable(params.keys()),
      (key) => key !== "businessSelection" && key !== "selection",
    )
  ) {
    return null
  }
  const supplied = params.get("businessSelection")
  if (supplied !== null) {
    return Result.try(() => JSON.parse(supplied) as unknown).pipe(
      Result.flatMap(decode),
      Result.getOrNull,
    )
  }
  const prior = params.get("selection")
  if (prior !== null) {
    const saved = Result.try(() => JSON.parse(prior) as unknown).pipe(
      Result.flatMap(
        Schema.decodeUnknownResult(SavedSelectionSchema, {
          onExcessProperty: "error",
        }),
      ),
      Result.getOrNull,
    )
    return saved?.kind === "run" &&
      saved.projectId === projectId &&
      saved.section === "events" &&
      saved.cursor === undefined &&
      pathname === `/runs/${saved.runId}`
      ? { kind: "run", runId: saved.runId }
      : null
  }
  if (
    params.has("inspector") ||
    params.has("reference") ||
    params.has("periodSelection") ||
    params.has("linkedComparison")
  ) {
    return null
  }
  return decode(
    /^\/runs\/[a-f0-9-]{36}$/i.test(pathname)
      ? { kind: "run", runId: pathname.split("/")[2] }
      : { kind: "overview" },
  ).pipe(Result.getOrNull)
}
