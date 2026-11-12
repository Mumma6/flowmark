import { Array, Option, pipe } from "effect"

/** Historical failure wins over completion; never infer activity from absence. */
export function terminalEvidence<A extends { readonly type: string }>(
  events: readonly A[],
) {
  const failure = Array.findFirst(events, (event) => event.type === "failed")
  const completed = Array.findLast(
    events,
    (event) => event.type === "completed",
  )
  const state = pipe(
    failure,
    Option.match({
      onSome: () => "Failed" as const,
      onNone: () =>
        pipe(
          completed,
          Option.match({
            onSome: () => "Completed" as const,
            onNone: () => "Running" as const,
          }),
        ),
    }),
  )
  return {
    failure: Option.getOrUndefined(failure),
    completed: Option.getOrUndefined(completed),
    state,
  }
}

export const durationDelta = (current: number | null, peer: number | null) =>
  pipe(
    Option.fromNullishOr(current),
    Option.zipWith(
      Option.fromNullishOr(peer),
      (value, baseline) => value - baseline,
    ),
    Option.getOrNull,
  )
