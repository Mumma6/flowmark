import { Context, Effect, Layer } from "effect"

/**
 * Sign-up only creates the Better Auth account. The first project and write
 * key are created explicitly in Settings via ManageProject.create.
 */
export interface RegisterOwnerService {
  readonly provision: (userId: string, name: string) => Effect.Effect<void>
}

export class RegisterOwner extends Context.Tag("@flowmark/api/RegisterOwner")<
  RegisterOwner,
  RegisterOwnerService
>() {
  static readonly layer = Layer.succeed(
    RegisterOwner,
    RegisterOwner.of({
      provision: Effect.fn("RegisterOwner.provision")(() => Effect.void),
    }),
  )
}
