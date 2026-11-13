import { Array, Effect, Option } from "effect"
import type {
  SharedInvestigation,
  SharedInvestigationSummary,
} from "@flowmarkdev/core"
import {
  decodePublication,
  publicationMeaning,
} from "../../business-evidence/rules/publication.js"
import type { SharedQuestionAccess } from "../ports/shared-investigations.js"
import {
  supportedSharedSelection,
  validateSharedSelection,
} from "../rules/selection.js"
export const visibleSharedInvestigations = Effect.fn(
  "SharedInvestigations.visible",
)(function* (projectId: string, access: SharedQuestionAccess, native = false) {
  const meaning = yield* Effect.cached(
    Effect.gen(function* () {
      const publication = yield* decodePublication(access.publication)
      return publicationMeaning(publication, yield* access.choices())
    }),
  )
  const records = yield* access.records()
  const entries = yield* Effect.forEach(records, (row) =>
    Effect.gen(function* () {
      const selection = supportedSharedSelection(row.selection)
      const canRevoke =
        native && (access.role === "owner" || access.userId === row.creatorId)
      const allowed =
        selection !== null &&
        (yield* validateSharedSelection(
          projectId,
          access.role,
          selection,
          selection.depth === "business"
            ? yield* meaning
            : { results: [], references: [] },
        ).pipe(
          Effect.as(true),
          Effect.catchTag("InvalidInput", () => Effect.succeed(false)),
        ))
      const question: SharedInvestigation | null =
        selection && allowed
          ? {
              id: row.id,
              title: row.title,
              createdAt: row.createdAt,
              depth: selection.depth,
              selection,
              canRevoke,
              available: true,
            }
          : null
      const metadata = Option.fromNullishOr(question).pipe(
        Option.map(summary),
        Option.orElse(() =>
          native && canRevoke
            ? Option.some({
                id: row.id,
                createdAt: row.createdAt,
                title: null,
                depth: null,
                canRevoke: true,
                available: false,
              } satisfies SharedInvestigationSummary)
            : Option.none(),
        ),
        Option.getOrNull,
      )
      return { question, metadata }
    }),
  )
  return {
    rows: Array.getSomes(
      Array.map(entries, (e) => Option.fromNullishOr(e.question)),
    ),
    summaries: Array.getSomes(
      Array.map(entries, (e) => Option.fromNullishOr(e.metadata)),
    ),
  }
})

const summary = ({
  id,
  title,
  createdAt,
  depth,
  canRevoke,
  available,
}: SharedInvestigation): SharedInvestigationSummary => ({
  id,
  title,
  createdAt,
  depth,
  canRevoke,
  available,
})
