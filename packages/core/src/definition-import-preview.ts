import { Array, Match, Option } from "effect"
import type { DefinitionImport } from "./definition-import.js"
import type { ResultDeclaration } from "./results.js"
import type { SearchFields } from "./search-fields.js"

export interface DefinitionImportSnapshot {
  readonly result: Option.Option<ResultDeclaration>
  readonly searchFields: SearchFields
}

/** Stable property order; optional aggregate=false and absence mean the same thing. */
export const canonicalResultDeclaration = (value: ResultDeclaration) => ({
  revision: value.revision,
  fields: Array.map(value.fields, (field) => ({
    path: field.path,
    label: field.label,
    kind: field.kind,
    unit: field.unit ?? null,
    aggregate: field.aggregate ?? false,
    values: field.values ?? null,
  })),
})

export const canonicalSearchFields = (fields: SearchFields) =>
  Array.map(fields, (field) =>
    Match.value(field).pipe(
      Match.when({ role: "lookup" }, ({ key, role }) => ({ key, role })),
      Match.when({ role: "dimension" }, ({ key, role, values }) => ({
        key,
        role,
        values,
      })),
      Match.exhaustive,
    ),
  )

const resultAction = (
  requested: ResultDeclaration | undefined,
  current: Option.Option<ResultDeclaration>,
) =>
  Option.fromUndefinedOr(requested).pipe(
    Option.match({
      onNone: () => "NotRequested" as const,
      onSome: (next) =>
        Option.match(current, {
          onNone: () => "Create" as const,
          onSome: (previous) =>
            Match.value(
              JSON.stringify(canonicalResultDeclaration(previous)) ===
                JSON.stringify(canonicalResultDeclaration(next)),
            ).pipe(
              Match.when(true, () => "Unchanged" as const),
              Match.when(false, () => "Conflict" as const),
              Match.exhaustive,
            ),
        }),
    }),
  )

/** Pure, bounded dry run. No ownership transfer, deletion or historical rewrite. */
export const previewDefinitionImport = (
  input: DefinitionImport,
  current: DefinitionImportSnapshot,
) => {
  const requested = input.searchFields ?? []
  const additions = Array.filter(
    requested,
    (next) =>
      !Array.some(current.searchFields, (field) => field.key === next.key),
  )
  const conflicts = Array.filter(requested, (next) =>
    Array.some(
      current.searchFields,
      (field) =>
        field.key === next.key &&
        JSON.stringify(canonicalSearchFields([field])) !==
          JSON.stringify(canonicalSearchFields([next])),
    ),
  )
  const proposedFields = Array.appendAll(current.searchFields, additions)
  const capacityExceeded = proposedFields.length > 8
  const result = resultAction(input.result, current.result)
  const status = Match.value({
    conflict: result === "Conflict" || conflicts.length > 0 || capacityExceeded,
    changed: result === "Create" || additions.length > 0,
  }).pipe(
    Match.when({ conflict: true }, () => "Conflict" as const),
    Match.when({ changed: true }, () => "Reviewable" as const),
    Match.orElse(() => "Unchanged" as const),
  )
  return {
    status,
    result: {
      action: result,
      current: Option.getOrNull(current.result),
      requested: input.result ?? null,
    },
    searchFields: {
      requested: input.searchFields !== undefined,
      additions,
      conflicts,
      capacityExceeded,
      retained: current.searchFields,
      // Never present a partial or invalid plan as an applicable configuration.
      proposed: status === "Conflict" ? null : proposedFields,
    },
  }
}

export type DefinitionImportPreview = ReturnType<typeof previewDefinitionImport>
