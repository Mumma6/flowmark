import { createHash } from "node:crypto"
import { Array, pipe } from "effect"

export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex")
export const uuid = (value: string) => {
  const hash = digest(value)
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}
/** A keyed deterministic sample; adding a scenario never shifts other scenarios. */
export const sample = (seed: string, key: string) =>
  Number.parseInt(digest(`${seed}:${key}`).slice(0, 8), 16) / 0x100000000

export const canonical = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${Array.map(value, canonical).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    return `{${pipe(
      Array.fromIterable(Object.entries(value)),
      Array.filter(([, item]) => item !== undefined),
      Array.sort((left: [string, unknown], right: [string, unknown]) =>
        left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0,
      ),
      Array.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`),
    ).join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}
