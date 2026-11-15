export type ProjectListState = "pending" | "unavailable" | "empty" | "ready"

/** A failed load with no cached projects is not an empty account. */
export function projectListState(input: {
  readonly pending: boolean
  readonly failed: boolean
  readonly count: number
}): ProjectListState {
  if (input.failed && input.count === 0) {
    return "unavailable"
  }
  if (input.pending && input.count === 0) {
    return "pending"
  }
  if (input.count === 0) {
    return "empty"
  }
  return "ready"
}
