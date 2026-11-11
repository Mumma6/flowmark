import { Context, Effect, Layer } from "effect"
import { Unauthorized } from "../../../errors.js"
import {
  DelegatedAccessRepository,
  type GrantFamilySelection,
} from "../ports/delegated-access-repository.js"

/** Live grant authority is rechecked for each read, never inferred from a token alone. */
export class AuthorizeAgentRead extends Context.Service<AuthorizeAgentRead>()(
  "@flowmark/api/AuthorizeAgentRead",
  {
    make: Effect.gen(function* () {
      const repository = yield* DelegatedAccessRepository
      return {
        grantFamily: Effect.fn("AuthorizeAgentRead.grantFamily")(function* (
          input: GrantFamilySelection,
        ) {
          const familyId = yield* repository.grantFamily(input)
          if (!familyId) {
            return yield* new Unauthorized({ permission: "read" })
          }
          return { familyId }
        }),
        consumeBudget: Effect.fn("AuthorizeAgentRead.consumeBudget")(
          (scope: string, maximum: number) =>
            repository.consumeBudget(scope, maximum),
        ),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
