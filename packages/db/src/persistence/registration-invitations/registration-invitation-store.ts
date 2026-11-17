import { Context, Effect, Layer, type Option } from "effect"
import { Database, provideDatabase, type DatabaseError } from "../database.js"
import { getRegistrationInvitation } from "./queries/get-registration-invitation.js"
import { createRegistrationInvitation } from "./writes/create-registration-invitation.js"
import { removeRegistrationInvitation } from "./writes/remove-registration-invitation.js"

interface RegistrationInvitationStoreService {
  readonly get: (
    email: string,
    hash: string,
  ) => Effect.Effect<Option.Option<{ readonly id: string }>, DatabaseError>
  readonly create: (
    email: string,
    hash: string,
  ) => Effect.Effect<Option.Option<{ readonly id: string }>, DatabaseError>
  readonly remove: (
    email: string,
    hash: string,
  ) => Effect.Effect<void, DatabaseError>
}

export class RegistrationInvitationStore extends Context.Service<RegistrationInvitationStore>()(
  "@flowmark/db/RegistrationInvitationStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        get: (email: string, hash: string) =>
          provide(getRegistrationInvitation(email, hash)),
        create: (email: string, hash: string) =>
          provide(createRegistrationInvitation(email, hash)),
        remove: (email: string, hash: string) =>
          provide(removeRegistrationInvitation(email, hash)),
      } satisfies RegistrationInvitationStoreService
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
