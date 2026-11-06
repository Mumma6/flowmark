export type ExpectationsPageCursor = {
  readonly declaredAt: string
  readonly expectationId: string
}

export function encodeExpectationsPageCursor(row: {
  readonly declaredAt: string | null
  readonly expectationId: string
}): string {
  const declaredAt = row.declaredAt ?? ""
  return `${declaredAt}|${row.expectationId}`
}

export function decodeExpectationsPageCursor(
  cursor: string | undefined,
): ExpectationsPageCursor | null {
  if (!cursor) {
    return null
  }
  const separator = cursor.indexOf("|")
  if (separator <= 0) {
    return null
  }
  const declaredAt = cursor.slice(0, separator)
  const expectationId = cursor.slice(separator + 1)
  if (!expectationId) {
    return null
  }
  if (declaredAt !== "" && Number.isNaN(Date.parse(declaredAt))) {
    return null
  }
  return { declaredAt, expectationId }
}
