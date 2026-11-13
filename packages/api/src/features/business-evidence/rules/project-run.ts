import { Array, Match, Option, Record } from "effect"
import type {
  BusinessRunSummary,
  PublishedResultField,
  BusinessMeaning,
} from "@flowmarkdev/core"
import type { StoredRun } from "../../workflows/types.js"
export const projectBusinessSummary = (
  run: Pick<
    StoredRun,
    "id" | "workflow" | "status" | "outcome" | "startedAt" | "durationMs"
  >,
): BusinessRunSummary => ({
  id: run.id,
  workflow: run.workflow,
  status: run.status,
  outcome: run.outcome ?? null,
  startedAt: new Date(run.startedAt).toISOString(),
  durationMs: run.durationMs,
})
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
const reasonCounts = (value: unknown): value is Record<string, number> =>
  object(value) && Array.every(Record.values(value), count)
const pathValue = (input: unknown, path: readonly string[]) =>
  Array.reduce(path, Option.some(input), (current, key) =>
    current.pipe(
      Option.flatMap((value) =>
        object(value) && Object.hasOwn(value, key)
          ? Option.some(value[key])
          : Option.none(),
      ),
    ),
  )
export const projectBusinessFields = (
  run: { workflow: string; definitionRevision: string | null; result: unknown },
  meaning: BusinessMeaning,
): readonly PublishedResultField[] =>
  Array.flatMap(meaning.results, (entry) =>
    entry.workflow === run.workflow && entry.revision === run.definitionRevision
      ? Array.map(entry.fields, (field) => {
          const value = Option.getOrUndefined(pathValue(run.result, field.path))
          const base = {
            revision: entry.revision,
            path: field.path,
            label: field.label,
            unit: field.unit ?? null,
            kind: field.kind,
          }
          if (value === undefined || value === null) {
            return { ...base, state: "missing" as const, value: null }
          }
          return Match.value(field.kind).pipe(
            Match.when("count", () =>
              count(value)
                ? { ...base, state: "available" as const, value }
                : { ...base, state: "wrong-type" as const, value: null },
            ),
            Match.when("category", () =>
              typeof value !== "string"
                ? { ...base, state: "wrong-type" as const, value: null }
                : Array.contains(field.values ?? [], value)
                  ? { ...base, state: "available" as const, value }
                  : {
                      ...base,
                      state: "unknown-category" as const,
                      value: null,
                    },
            ),
            Match.when("reasons", () => {
              if (!reasonCounts(value)) {
                return { ...base, state: "wrong-type" as const, value: null }
              }
              if (
                !Array.every(Record.keys(value), (key) =>
                  Array.contains(field.values ?? [], key),
                )
              ) {
                return {
                  ...base,
                  state: "unknown-category" as const,
                  value: null,
                }
              }
              return {
                ...base,
                state: "available" as const,
                value: Array.map(Record.toEntries(value), ([key, n]) => ({
                  value: key,
                  count: n,
                })),
              }
            }),
            Match.exhaustive,
          )
        })
      : [],
  )
export const projectBusinessReferences = (
  workflow: string,
  properties: unknown,
  meaning: BusinessMeaning,
) =>
  Array.flatMap(meaning.references, (entry) =>
    entry.workflow === workflow && object(properties)
      ? Array.flatMap(entry.keys, (key) =>
          typeof properties[key] === "string" &&
          properties[key].length > 0 &&
          properties[key].length <= 256
            ? [{ key, value: properties[key] }]
            : [],
        )
      : [],
  )
