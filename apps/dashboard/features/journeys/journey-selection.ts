import {
  ReferenceJourneyQuerySchema,
  type ReferenceJourneyPage,
  type ReferenceJourneyQuery,
} from "@flowmarkdev/core"
import { Array, Match, Result, Schema } from "effect"

export const journeyQueryKey = "journey"
export const initialJourneyQuery = (
  query: ReferenceJourneyQuery,
): ReferenceJourneyQuery => ({
  ...query,
  cursor: undefined,
  candidateCursor: undefined,
})
export const JourneySelectionSchema = Schema.Struct({
  projectId: Schema.String.check(Schema.isGUID()),
  stage: Schema.Literals(["configure", "evidence"]),
  query: ReferenceJourneyQuerySchema,
})
export type JourneySelection = typeof JourneySelectionSchema.Type
export type JourneyPageParam =
  | { readonly kind: "initial" }
  | { readonly kind: "candidates"; readonly cursor: string }
  | {
      readonly kind: "nodes"
      readonly cursor: string
      readonly anchorRunId: string
    }

export const readJourneySelection = (raw: string, projectId: string) =>
  Schema.decodeUnknownResult(Schema.fromJsonString(JourneySelectionSchema))(
    raw,
    { onExcessProperty: "error" },
  ).pipe(
    Result.mapError(
      () => "This journey selection is invalid. Open an exact reference again.",
    ),
    Result.flatMap((selection) =>
      selection.projectId === projectId
        ? Result.succeed(selection)
        : Result.fail(
            "This journey belongs to another project. Open a reference in the selected project.",
          ),
    ),
  )

export const journeyHref = (source: string, selection: JourneySelection) => {
  const params = new URLSearchParams(source.split("?")[1] ?? "")
  Array.forEach(["from", "view", "event", "selection"], (key) =>
    params.delete(key),
  )
  params.set(journeyQueryKey, JSON.stringify(selection))
  return `/?${params}`
}

export const startJourneyHref = (
  projectId: string,
  reference: Pick<ReferenceJourneyQuery, "workflow" | "key" | "value">,
  source = "/",
) =>
  journeyHref(source, {
    projectId,
    stage: "configure",
    query: {
      workflow: reference.workflow,
      key: reference.key,
      value: reference.value,
      namespaces: [{ workflow: reference.workflow, key: reference.key }],
      limit: 25,
    },
  })

export const nextJourneyPage = (
  page: ReferenceJourneyPage,
): JourneyPageParam | undefined => {
  if (page.state === "Ambiguous" && page.nextCandidateCursor) {
    return { kind: "candidates", cursor: page.nextCandidateCursor }
  }
  if (page.state === "Selected" && page.anchorRunId && page.nextCursor) {
    return {
      kind: "nodes",
      cursor: page.nextCursor,
      anchorRunId: page.anchorRunId,
    }
  }
  return undefined
}

export const journeyPageInput = (
  query: ReferenceJourneyQuery,
  page: JourneyPageParam,
): ReferenceJourneyQuery =>
  Match.value(page).pipe(
    Match.when({ kind: "candidates" }, (page) => ({
      ...query,
      limit: 25,
      anchorRunId: undefined,
      cursor: undefined,
      candidateCursor: page.cursor,
    })),
    Match.when({ kind: "nodes" }, (page) => ({
      ...query,
      limit: 25,
      candidateCursor: undefined,
      anchorRunId: page.anchorRunId,
      cursor: page.cursor,
    })),
    Match.when({ kind: "initial" }, () => ({ ...query, limit: 25 })),
    Match.exhaustive,
  )
