import type { ResultDeclaration } from "../presentation/result-presentation"

export type Field = {
  path: string
  label: string
  kind: "count" | "category" | "reasons"
  unit: string
  aggregate: boolean
  values: string
}
export const blankField = (): Field => ({
  path: "",
  label: "",
  kind: "count",
  unit: "",
  aggregate: false,
  values: "",
})

export function buildDeclaration(
  revision: string,
  fields: readonly Field[],
): ResultDeclaration {
  return {
    revision,
    fields: fields.map((field) => ({
      path: field.path.split("."),
      label: field.label,
      kind: field.kind,
      aggregate: field.aggregate,
      ...(field.kind !== "count" && field.values.trim()
        ? {
            values: field.values.split(",").map((value) => value.trim()),
          }
        : {}),
      ...(field.unit ? { unit: field.unit } : {}),
    })),
  }
}
