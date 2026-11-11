import { Iterable, Option, Result, Schema, pipe } from "effect"

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

/** Lazy immutable scan: stop on the first failure without allocating a sparse array. */
const validateSequence = <A>(
  values: Iterable<A>,
  length: number,
  keys: number,
  validate: (value: A, keys: number) => Option.Option<number>,
): Option.Option<number> =>
  pipe(
    values,
    Iterable.scan({ visited: 0, keys: Option.some(keys) }, (state, value) => ({
      visited: state.visited + 1,
      keys: Option.flatMap(state.keys, (count) => validate(value, count)),
    })),
    Iterable.findFirst(
      (state) => state.visited === length || Option.isNone(state.keys),
    ),
    Option.flatMap((state) => state.keys),
  )

const visitJson = (
  value: unknown,
  depth: number,
  ancestors: readonly object[],
  keys: number,
): Option.Option<number> => {
  if (depth > WORKFLOW_JSON_LIMITS.maxDepth) {
    return Option.none()
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return Option.some(keys)
  }
  if (typeof value === "string") {
    return Option.liftPredicate(
      keys,
      () => value.length <= WORKFLOW_JSON_LIMITS.maxStringLength,
    )
  }
  if (
    typeof value !== "object" ||
    ancestors.some((ancestor) => ancestor === value)
  ) {
    return Option.none()
  }
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    return Option.none()
  }
  // Depth is capped at five; reference identity must not invoke unknown Hash/Equal protocols.
  const nextAncestors = [...ancestors, value]
  if (Array.isArray(value)) {
    return validateSequence(
      Iterable.makeBy((index) => index, { length: value.length }),
      value.length,
      keys,
      (index, count) =>
        index in value
          ? visitJson(value[index], depth + 1, nextAncestors, count)
          : Option.none(),
    )
  }
  const entries = Object.entries(value)
  const totalKeys = keys + entries.length
  if (totalKeys > WORKFLOW_JSON_LIMITS.maxKeys) {
    return Option.none()
  }
  return validateSequence(
    entries,
    entries.length,
    totalKeys,
    ([key, item], count) =>
      key.length <= WORKFLOW_JSON_LIMITS.maxKeyLength
        ? visitJson(item, depth + 1, nextAncestors, count)
        : Option.none(),
  )
}

const isBoundedJsonObject = (input: unknown): input is WorkflowProperties =>
  Result.try(
    () =>
      input !== null &&
      typeof input === "object" &&
      !Array.isArray(input) &&
      Option.isSome(visitJson(input, 0, [], 0)) &&
      new TextEncoder().encode(JSON.stringify(input)).byteLength <=
        WORKFLOW_JSON_LIMITS.maxBytes,
  ).pipe(Result.match({ onFailure: () => false, onSuccess: (valid) => valid }))

const WorkflowJsonObjectSchema = Schema.Record(
  Schema.String,
  Schema.Unknown,
).pipe(Schema.refine(isBoundedJsonObject))

export const WorkflowPropertiesSchema = WorkflowJsonObjectSchema
export const WorkflowResultSchema = WorkflowJsonObjectSchema
