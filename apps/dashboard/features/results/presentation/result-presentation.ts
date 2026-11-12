import type { AppRouter } from "@flowmark/server/trpc"
import type { inferRouterOutputs } from "@trpc/server"
import { Array, Match, Option, pipe } from "effect"

export type ResultDeclaration =
  inferRouterOutputs<AppRouter>["resultDeclarations"]["list"][number]

export function resultPath(value: unknown, path: readonly string[]): unknown {
  return pipe(
    path.reduce<Option.Option<unknown>>(
      (current, key) =>
        pipe(
          current,
          Option.filter(
            (item): item is Record<string, unknown> =>
              item !== null &&
              typeof item === "object" &&
              !Array.isArray(item) &&
              Object.hasOwn(item, key),
          ),
          Option.flatMap((item) => Option.fromUndefinedOr(item[key])),
        ),
      Option.fromUndefinedOr(value),
    ),
    Option.getOrUndefined,
  )
}

/** A revision is selected from the original start, never amended context. */
export function declarationForRun(
  declarations: readonly ResultDeclaration[],
  startProperties: Record<string, unknown> | null | undefined,
) {
  const revision =
    startProperties && Object.hasOwn(startProperties, "definitionRevision")
      ? startProperties.definitionRevision
      : undefined
  return pipe(
    declarations,
    Array.findFirst((item) => item.revision === revision),
    Option.getOrUndefined,
  )
}

export function declaredResults(
  result: unknown,
  declaration: ResultDeclaration,
) {
  return declaration.fields.map((field) => {
    const value = resultPath(result, field.path)
    const missing = value === undefined
    const count = (v: unknown): v is number =>
      typeof v === "number" && Number.isSafeInteger(v) && v >= 0
    const valid = Match.value(field.kind).pipe(
      Match.when("count", () => count(value)),
      Match.when(
        "category",
        () => typeof value === "string" || typeof value === "boolean",
      ),
      Match.when(
        "reasons",
        () =>
          value !== null &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          Object.values(value).every(count),
      ),
      Match.exhaustive,
    )
    const entries =
      valid && field.kind === "reasons"
        ? Object.entries(value as Record<string, number>)
        : []
    return {
      ...field,
      state: missing ? "Not reported" : valid ? "Reported" : "Unexpected type",
      value: valid && field.kind !== "reasons" ? String(value) : null,
      reasons: entries.slice(0, 24),
      omittedReasons: Math.max(0, entries.length - 24),
    }
  })
}
