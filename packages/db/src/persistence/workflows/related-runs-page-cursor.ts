export type RelatedRunsPageCursor = {
  readonly startedAt: string
  readonly id: string
}

export function encodeRelatedRunsPageCursor(row: {
  readonly startedAt: string
  readonly id: string
}): string {
  return `${row.startedAt}|${row.id}`
}

export function decodeRelatedRunsPageCursor(
  cursor: string | undefined,
): RelatedRunsPageCursor | null {
  if (!cursor) {
    return null
  }
  const parts = cursor.split("|")
  if (parts.length !== 2) {
    return null
  }
  const [startedAt, id] = parts
  if (!startedAt || !id) {
    return null
  }
  if (Number.isNaN(Date.parse(startedAt))) {
    return null
  }
  return { startedAt, id }
}
