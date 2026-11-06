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

export function decodeRunEventPageCursor(
  cursor: string | undefined,
): RunEventPageCursor | null {
  if (!cursor) {
    return null
  }
  const parts = cursor.split("|")
  if (parts.length !== 3) {
    return null
  }
  const [occurredAt, receivedAt, eventId] = parts
  if (!occurredAt || !receivedAt || !eventId) {
    return null
  }
  if (
    Number.isNaN(Date.parse(occurredAt)) ||
    Number.isNaN(Date.parse(receivedAt))
  ) {
    return null
  }
  return { occurredAt, receivedAt, eventId }
}
