import { Option, Result } from "effect"
import { decodePageCursor, encodePageCursor } from "./page-cursor.js"

export type OperationsPageCursor = {
  readonly startedAt: string
  readonly operationId: string
}

export const encodeOperationsPageCursor = (row: OperationsPageCursor): string =>
  encodePageCursor(row.startedAt, row.operationId)

/** Keep this historical nullable API; queries reject a supplied invalid cursor. */
export const decodeOperationsPageCursor = (
  cursor: string | undefined,
): OperationsPageCursor | null =>
  decodePageCursor(cursor).pipe(
    Result.match({
      onFailure: () => null,
      onSuccess: (value) =>
        value.pipe(
          Option.map(({ timestamp, id }) => ({
            startedAt: timestamp,
            operationId: id,
          })),
          Option.getOrNull,
        ),
    }),
  )
