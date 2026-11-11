import { Option, Result, Schema } from "effect"

/** Stable keyset cursor for run timeline event pages (occurredAt, createdAt, eventId). */
export type RunEventPageCursor = {
  readonly occurredAt: string
  readonly receivedAt: string
  readonly eventId: string
}

export function encodeRunEventPageCursor(row: {
  readonly occurredAt: string
  readonly receivedAt: string
  readonly eventId: string
}): string {
  return `${row.occurredAt}|${row.receivedAt}|${row.eventId}`
}

const instant = Schema.String.check(
  Schema.isMinLength(1),
  Schema.makeFilter((value) => Number.isFinite(Date.parse(value))),
)
const cursorTuple = Schema.Tuple([
  instant,
  instant,
  Schema.String.check(Schema.isGUID()),
])

/** Preserve timestamp precision and the wire format; reject invalid SQL identifiers before querying. */
export const decodeRunEventPageCursor = (
  cursor: string | undefined,
): RunEventPageCursor | null =>
  Option.fromNullishOr(cursor).pipe(
    Option.filter((value) => value.length > 0),
    Option.flatMap((value) =>
      Schema.decodeUnknownResult(cursorTuple)(value.split("|")).pipe(
        Result.match({
          onFailure: () => Option.none<RunEventPageCursor>(),
          onSuccess: ([occurredAt, receivedAt, eventId]) =>
            Option.some({ occurredAt, receivedAt, eventId }),
        }),
      ),
    ),
    Option.getOrNull,
  )
