import { BOUNDED_RECORD_PREVIEW_MAX_BYTES } from "./bounded-read-limits.js"

export type BoundedRecordPreview = {
  readonly value: unknown
  readonly truncated: boolean
  readonly omissions: ReadonlyArray<string>
}

const byteLength = (value: string) => new TextEncoder().encode(value).length

export function boundJsonPreview(
  value: unknown,
  maxBytes: number = BOUNDED_RECORD_PREVIEW_MAX_BYTES,
): BoundedRecordPreview {
  if (value === undefined) {
    return { value, truncated: false, omissions: [] }
  }
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    return {
      value: { kind: "unserializable" },
      truncated: true,
      omissions: ["Value could not be serialized as JSON"],
    }
  }
  if (byteLength(serialized) <= maxBytes) {
    return { value, truncated: false, omissions: [] }
  }
  return {
    value: {
      kind: "bounded_preview",
      byteLength: byteLength(serialized),
      maxBytes,
    },
    truncated: true,
    omissions: [
      `Recorded payload exceeds the ${maxBytes}-byte bounded preview limit; open the full timeline export or paginated event read for complete evidence.`,
    ],
  }
}
