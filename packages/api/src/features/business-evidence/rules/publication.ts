import { Array, Effect, Option, Schema, pipe } from "effect"
import {
  BusinessPublicationSchema,
  type BusinessPublication,
  type ResultDeclaration,
} from "@flowmarkdev/core"
import { InvalidInput } from "../../../errors.js"
import type { PublicationChoices } from "../ports/business-evidence.js"
export const decodePublication = (input: unknown) =>
  Schema.decodeUnknownEffect(BusinessPublicationSchema, {
    onExcessProperty: "error",
  })(input).pipe(
    Effect.mapError(
      () => new InvalidInput({ cause: "Invalid business publication." }),
    ),
  )
export const samePath = (left: readonly string[], right: readonly string[]) =>
  JSON.stringify(left) === JSON.stringify(right)
export const publishableField = (field: ResultDeclaration["fields"][number]) =>
  field.kind === "count" ||
  (field.values !== undefined && field.values.length > 0)
export const publicationMeaning = (
  publication: BusinessPublication,
  choices: PublicationChoices,
) => ({
  results: Array.map(publication.results, (entry) => ({
    workflow: entry.workflow,
    revision: entry.revision,
    fields: Array.flatMap(choices.declarations, (row) =>
      row.workflow === entry.workflow &&
      row.declaration.revision === entry.revision
        ? pipe(
            row.declaration.fields,
            Array.filter(
              (field) =>
                publishableField(field) &&
                Array.some(entry.paths, (path) => samePath(path, field.path)),
            ),
            Array.map((field) => ({
              path: field.path,
              label: field.label,
              kind: field.kind,
              aggregate: field.aggregate === true,
              ...(field.unit === undefined ? {} : { unit: field.unit }),
              ...(field.values === undefined ? {} : { values: field.values }),
            })),
          )
        : [],
    ),
  })),
  references: Array.map(publication.references, (entry) => ({
    workflow: entry.workflow,
    keys: Array.filter(entry.keys, (key) =>
      Array.some(
        choices.references,
        (row) =>
          row.workflow === entry.workflow &&
          Array.some(row.fields, (field) => field.key === key),
      ),
    ),
  })),
})
export const assertPublishedReference = (
  publication: BusinessPublication,
  workflow: string | undefined,
  key: string,
) =>
  Array.some(
    publication.references,
    (entry) => entry.workflow === workflow && Array.contains(entry.keys, key),
  )
    ? Effect.void
    : Effect.fail(
        new InvalidInput({
          cause: "This selector is withheld from business evidence.",
        }),
      )
export const validatePublication = Effect.fn("validateBusinessPublication")(
  function* (publication: BusinessPublication, choices: PublicationChoices) {
    if (
      Array.dedupe(
        Array.map(publication.results, (e) =>
          JSON.stringify([e.workflow, e.revision]),
        ),
      ).length !== publication.results.length ||
      Array.dedupe(Array.map(publication.references, (e) => e.workflow))
        .length !== publication.references.length
    ) {
      return yield* new InvalidInput({
        cause: "Publication entries must be distinct.",
      })
    }
    yield* Effect.forEach(publication.results, (entry) =>
      Effect.gen(function* () {
        const declaration = Option.getOrUndefined(
          Array.findFirst(
            choices.declarations,
            (row) =>
              row.workflow === entry.workflow &&
              row.declaration.revision === entry.revision,
          ),
        )?.declaration
        if (
          !declaration ||
          Array.dedupe(Array.map(entry.paths, (p) => JSON.stringify(p)))
            .length !== entry.paths.length ||
          !Array.every(entry.paths, (path) =>
            Array.some(
              declaration.fields,
              (field) => samePath(path, field.path) && publishableField(field),
            ),
          )
        ) {
          return yield* new InvalidInput({
            cause:
              "Select existing declared count fields or closed category/reason fields.",
          })
        }
      }),
    )
    yield* Effect.forEach(publication.references, (entry) =>
      Effect.gen(function* () {
        if (
          Array.dedupe(entry.keys).length !== entry.keys.length ||
          !Array.every(entry.keys, (key) =>
            Array.some(
              choices.references,
              (row) =>
                row.workflow === entry.workflow &&
                Array.some(row.fields, (field) => field.key === key),
            ),
          )
        ) {
          return yield* new InvalidInput({
            cause: "Select existing declared reference keys.",
          })
        }
      }),
    )
  },
)
