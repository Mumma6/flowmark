import { Data, Option, Result, Schema } from "effect"

class InvalidPageCursor extends Data.TaggedError("InvalidPageCursor") {}
const tuple = Schema.Tuple([
  Schema.String.check(
    Schema.isMinLength(1),
    Schema.makeFilter((value) => !Number.isNaN(Date.parse(value))),
  ),
  Schema.String.check(Schema.isMinLength(1)),
])

/** Preserve the existing unnormalised timestamp and identifier wire representation. */
export const encodePageCursor = (timestamp: string, id: string) =>
  `${timestamp}|${id}`

/** Missing (including the legacy empty value) and malformed cursors stay distinct internally. */
type PageCursor = { readonly timestamp: string; readonly id: string }
export const decodePageCursor = (
  cursor: string | undefined,
): Result.Result<Option.Option<PageCursor>, InvalidPageCursor> =>
  cursor
    ? Schema.decodeUnknownResult(tuple)(cursor.split("|")).pipe(
        Result.map(([timestamp, id]) => Option.some({ timestamp, id })),
        Result.mapError(() => new InvalidPageCursor()),
      )
    : Result.succeed(
        Option.none<{ readonly timestamp: string; readonly id: string }>(),
      )
