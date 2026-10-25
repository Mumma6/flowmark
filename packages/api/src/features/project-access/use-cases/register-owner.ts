import { Context, Effect, Layer } from "effect"
import type { PersistenceError } from "../../../errors.js"
import { ProjectCredentials } from "../ports/project-credentials.js"

export interface RegisterOwnerService {
  readonly provision: (
    userId: string,
    name: string,
  ) => Effect.Effect<
    {
      readonly projectId: string
      readonly writeKey: string
    },
    PersistenceError
  >
}

export class RegisterOwner extends Context.Tag(
  "@flowmark/api/RegisterOwner",
)<RegisterOwner, RegisterOwnerService>() {
  static readonly layer = Layer.effect(
    RegisterOwner,
    Effect.gen(function* () {
      const credentials = yield* ProjectCredentials
      const provision = Effect.fn("RegisterOwner.provision")(function* (
        userId: string,
        name: string,
      ) {
        const workspace = name.trim().length > 0 ? name.trim() : "Workspace"
        const created = yield* credentials.createOwnedProject(userId, {
          workspace,
          project: workspace,
        })
        return {
          projectId: created.projectId,
          writeKey: created.writeKey,
        }
      })
      return RegisterOwner.of({ provision })
    }),
  )
}
