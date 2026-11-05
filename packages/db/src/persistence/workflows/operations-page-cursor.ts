export type OperationsPageCursor = {
  readonly startedAt: string
  readonly operationId: string
}

export function encodeOperationsPageCursor(row: {
  readonly startedAt: string
  readonly operationId: string
}): string {
  return `${row.startedAt}|${row.operationId}`
}

export function decodeOperationsPageCursor(
  cursor: string | undefined,
): OperationsPageCursor | null {
  if (!cursor) {
    return null
  }
  const parts = cursor.split("|")
  if (parts.length !== 2) {
    return null
  }
  const [startedAt, operationId] = parts
  if (!startedAt || !operationId) {
    return null
  }
  if (Number.isNaN(Date.parse(startedAt))) {
    return null
  }
  return { startedAt, operationId }
}
