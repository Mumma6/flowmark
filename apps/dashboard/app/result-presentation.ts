import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"
export type ResultDeclaration =
  inferRouterOutputs<AppRouter>["resultDeclarations"]["list"][number]

export function resultPath(value: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (item, key) =>
      item !== null &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.hasOwn(item, key)
        ? (item as Record<string, unknown>)[key]
        : undefined,
    value,
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
  return declarations.find((item) => item.revision === revision)
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
    const valid =
      field.kind === "count"
        ? count(value)
        : field.kind === "category"
          ? typeof value === "string" || typeof value === "boolean"
          : value !== null &&
            typeof value === "object" &&
            !Array.isArray(value) &&
            Object.values(value).every(count)
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
