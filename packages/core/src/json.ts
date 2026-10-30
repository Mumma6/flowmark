import { Schema } from "effect"

/**
 * Limits applied to properties and results in both the SDK and ingestion API.
 * Nested values allow at most five levels, 128 keys total, 128 characters per
 * key, 2,048 characters per string, and 16 KiB of UTF-8 JSON per object.
 */
export const WORKFLOW_JSON_LIMITS = {
  maxDepth: 5,
  maxKeys: 128,
  maxKeyLength: 128,
  maxStringLength: 2048,
  maxBytes: 16 * 1024,
} as const

/** Recursive JSON value admitted by the bounded workflow context/result schema. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | {
      readonly [key: string]: JsonValue
    }
/** Bounded JSON-safe context object accepted on starts, steps, and amendments. */
export type WorkflowProperties = Record<string, JsonValue>
/** Bounded JSON-safe object recorded when a run completes. */
export type WorkflowResult = Record<string, JsonValue>

const isBoundedJsonObject = (input: unknown): input is WorkflowProperties => {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return false
  }
  let keys = 0
  const ancestors = new Set<object>()
  try {
    const visit = (value: unknown, depth: number): boolean => {
      if (depth > WORKFLOW_JSON_LIMITS.maxDepth) {
        return false
      }
      if (
        value === null ||
        typeof value === "boolean" ||
        (typeof value === "number" && Number.isFinite(value))
      ) {
        return true
      }
      if (typeof value === "string") {
        return value.length <= WORKFLOW_JSON_LIMITS.maxStringLength
      }
      if (typeof value !== "object") {
        return false
      }
      if (ancestors.has(value)) {
        return false
      }
      if (
        !Array.isArray(value) &&
        Object.getPrototypeOf(value) !== Object.prototype &&
        Object.getPrototypeOf(value) !== null
      ) {
        return false
      }
      ancestors.add(value)
      let valid = true
      if (Array.isArray(value)) {
        for (let index = 0; index < value.length; index += 1) {
          if (!(index in value) || !visit(value[index], depth + 1)) {
            valid = false
            break
          }
        }
      } else {
        const entries = Object.entries(value)
        keys += entries.length
        valid =
          keys <= WORKFLOW_JSON_LIMITS.maxKeys &&
          entries.every(
            ([key, item]) =>
              key.length <= WORKFLOW_JSON_LIMITS.maxKeyLength &&
              visit(item, depth + 1),
          )
      }
      ancestors.delete(value)
      return valid
    }
    if (!visit(input, 0)) {
      return false
    }
    return (
      new TextEncoder().encode(JSON.stringify(input)).byteLength <=
      WORKFLOW_JSON_LIMITS.maxBytes
    )
  } catch {
    return false
  }
}
const WorkflowJsonObjectSchema = Schema.Record(
  Schema.String,
  Schema.Unknown,
).pipe(Schema.refine(isBoundedJsonObject))

export const WorkflowPropertiesSchema = WorkflowJsonObjectSchema
export const WorkflowResultSchema = WorkflowJsonObjectSchema
