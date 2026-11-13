import { Effect } from "effect"
import { Unauthorized } from "@flowmark/api"
import { sharingIdentity } from "./project-sharing-boundary"
export const native = <A, E, R>(
  request: Request,
  userId: string,
  use: Effect.Effect<A, E, R>,
) =>
  Effect.gen(function* () {
    const actor = yield* sharingIdentity(request).current
    if (actor.userId !== userId) {
      return yield* new Unauthorized({ permission: "write" })
    }
    return yield* use
  })
