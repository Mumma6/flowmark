import { Array, Match, pipe } from "effect"

/** Last shallow amendment wins, retaining insertion order and literal keys. */
export const mergedRunContext = <
  A extends {
    readonly type: string
    readonly properties?: Record<string, unknown> | null
  },
>(
  events: readonly A[],
) =>
  pipe(
    events,
    Array.filter((event) =>
      Match.value(event.type).pipe(
        Match.when("started", () => true),
        Match.when("properties", () => true),
        Match.orElse(() => false),
      ),
    ),
    Array.flatMap((event) => Object.entries(event.properties ?? {})),
    (entries) => new Map(entries),
  )
