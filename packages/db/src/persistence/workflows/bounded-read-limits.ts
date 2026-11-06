/** Matches Agent ADR 0008 section bounds (see @flowmark/auth agent-access). */
export const BOUNDED_SECTION_DEFAULT_LIMIT = 25
export const BOUNDED_SECTION_MAX_LIMIT = 100

/** Per-record preview budget before explicit omission metadata is attached. */
export const BOUNDED_RECORD_PREVIEW_MAX_BYTES = 8 * 1024

/** Server-applied page size. `null` means the requested limit is not a positive integer. */
export const resolveBoundedSectionLimit = (
  requested: number | undefined,
): number | null => {
  if (requested === undefined) {
    return BOUNDED_SECTION_DEFAULT_LIMIT
  }
  if (!Number.isInteger(requested) || requested < 1) {
    return null
  }
  return Math.min(requested, BOUNDED_SECTION_MAX_LIMIT)
}
