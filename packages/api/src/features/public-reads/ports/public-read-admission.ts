import { Context, type Effect } from "effect"
import type { PublicReadFailure } from "../errors.js"

export class PublicReadAdmission extends Context.Service<
  PublicReadAdmission,
  {
    readonly consume: (
      scope: string,
      maximum: number,
    ) => Effect.Effect<void, PublicReadFailure>
  }
>()("@flowmark/api/PublicReadAdmission") {}
