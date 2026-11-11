import { Option, Result } from "effect"
import { decodePageCursor, encodePageCursor } from "./page-cursor.js"

export type RelatedRunsPageCursor = {
  readonly startedAt: string
  readonly id: string
}

export const encodeRelatedRunsPageCursor = (
  row: RelatedRunsPageCursor,
): string => encodePageCursor(row.startedAt, row.id)

/** Keep this historical nullable API; queries reject a supplied invalid cursor. */
export const decodeRelatedRunsPageCursor = (
  cursor: string | undefined,
): RelatedRunsPageCursor | null =>
  decodePageCursor(cursor).pipe(
    Result.match({
      onFailure: () => null,
      onSuccess: (value) =>
        value.pipe(
          Option.map(({ timestamp, id }) => ({ startedAt: timestamp, id: id })),
          Option.getOrNull,
        ),
    }),
  )
