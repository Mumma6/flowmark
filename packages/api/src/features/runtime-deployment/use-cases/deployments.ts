import { createHash, randomBytes } from "node:crypto"
import {
  ArtifactManifestSchema,
  createArtifactManifest,
} from "@flowmarkdev/core"
import { DeploymentRepository } from "../ports/deployment-repository.js"
import { Context, Effect, Layer, Schema } from "effect"
import { InvalidInput, Unauthorized } from "../../../errors.js"
import { AuthorizeProject } from "../../project-access/use-cases/authorize-project.js"

const Uuid = Schema.String.check(Schema.isUUID())
const DeploymentId = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/),
)
const ScopeName = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/),
)
export const DeploymentBindingInput = Schema.Struct({
  projectId: Uuid,
  repository: ArtifactManifestSchema.fields.repository,
  service: ScopeName,
  environment: ScopeName,
})
export const DeploymentReadInput = Schema.Struct({
  projectId: Uuid,
  bindingId: Uuid,
  deploymentId: DeploymentId,
})

const Callback = Schema.Struct({
  bindingId: Uuid,
  deploymentId: DeploymentId,
  manifest: ArtifactManifestSchema,
})

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex")

export class Deployments extends Context.Service<Deployments>()(
  "@flowmark/api/Deployments",
  {
    make: Effect.gen(function* () {
      const store = yield* DeploymentRepository
      const authorization = yield* AuthorizeProject
      return {
        rotateBinding: Effect.fn("Deployments.rotateBinding")(function* (
          userId: string,
          scope: typeof DeploymentBindingInput.Type,
        ) {
          yield* authorization.authorizeOwner(userId, scope.projectId)
          const token = `fmd_${randomBytes(32).toString("hex")}`
          const binding = yield* store.rotateBinding(
            userId,
            scope,
            sha256(token),
          )
          return { bindingId: binding.id, token }
        }),
        record: Effect.fn("Deployments.record")(function* (
          header: string | null,
          body: Effect.Effect<unknown, InvalidInput>,
        ) {
          if (!header || !/^Bearer fmd_[a-f0-9]{64}$/.test(header)) {
            return yield* new Unauthorized({ permission: "write" })
          }
          const input = yield* body.pipe(
            Effect.flatMap(
              Schema.decodeUnknownEffect(Callback, {
                onExcessProperty: "error",
              }),
            ),
            Effect.mapError(
              () => new InvalidInput({ cause: "Invalid deployment callback." }),
            ),
          )
          const manifest = createArtifactManifest(input.manifest)
          const result = yield* store.record({
            ...input,
            manifest,
            manifestDigest: `sha256:${sha256(JSON.stringify(manifest))}`,
            secretHash: sha256(header.slice("Bearer ".length)),
          })
          if (result.status === "denied") {
            return yield* new Unauthorized({ permission: "write" })
          }
          return result
        }),
        read: Effect.fn("Deployments.read")(function* (
          userId: string,
          input: typeof DeploymentReadInput.Type,
        ) {
          yield* authorization.authorizeOwner(userId, input.projectId)
          return yield* store.read(
            userId,
            input.projectId,
            input.bindingId,
            input.deploymentId,
          )
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
