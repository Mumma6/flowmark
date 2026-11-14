import { Array, Effect, Match } from "effect"
import type { BusinessEvidenceQuery, BusinessMeaning } from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import { assertPublishedReference } from "./publication.js"

/** Validate before reading either evidence or a shared question's metadata. */
export const validateBusinessSelection = Effect.fn("validateBusinessSelection")(
  function* (input: BusinessEvidenceQuery, meaning: BusinessMeaning) {
    const reference = (workflow: string | undefined, key: string) =>
      assertPublishedReference(
        { results: [], references: meaning.references },
        workflow,
        key,
      )
    yield* Match.value(input).pipe(
      Match.when({ kind: "overview" }, () => Effect.void),
      Match.when({ kind: "run" }, () => Effect.void),
      Match.when({ kind: "compare" }, () => Effect.void),
      Match.when({ kind: "runs" }, ({ query }) =>
        query.businessKey === undefined
          ? Effect.void
          : reference(query.workflow, query.businessKey),
      ),
      Match.when({ kind: "journey" }, ({ query }) =>
        Effect.gen(function* () {
          yield* reference(query.workflow, query.key)
          yield* Effect.forEach(query.namespaces, (n) =>
            reference(n.workflow, n.key),
          )
        }),
      ),
      Match.when({ kind: "insights" }, ({ query }) =>
        Effect.gen(function* () {
          if (query.releaseA !== undefined || query.releaseB !== undefined) {
            return yield* new InvalidInput({
              cause: "Release filters are withheld from business evidence.",
            })
          }
          if (query.businessKey !== undefined) {
            yield* reference(query.workflow, query.businessKey)
          }
          yield* Effect.forEach(
            [
              query.path,
              ...(query.numerator ? [query.numerator] : []),
              ...(query.denominator ? [query.denominator] : []),
            ],
            (path) =>
              Array.some(
                meaning.results,
                (e) =>
                  e.workflow === query.workflow &&
                  e.revision === query.revision &&
                  Array.some(
                    e.fields,
                    (f) =>
                      f.aggregate &&
                      JSON.stringify(f.path) === JSON.stringify(path),
                  ),
              )
                ? Effect.void
                : Effect.fail(
                    new InvalidInput({
                      cause:
                        "This result selector is withheld from business evidence.",
                    }),
                  ),
          )
        }),
      ),
      Match.exhaustive,
    )
  },
)
