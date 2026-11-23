import type { ArtifactManifest } from "@flowmarkdev/core"
import { Context, type Effect } from "effect"
import type { PersistenceError } from "../../../errors.js"

type BindingScope = {
  readonly projectId: string
  readonly repository: string
  readonly service: string
  readonly environment: string
}

type Receipt = {
  readonly projectId: string
  readonly bindingId: string
  readonly deploymentId: string
  readonly manifestDigest: string
  readonly manifest: ArtifactManifest
  readonly receivedAt: Date
}

type RecordResult =
  | { readonly status: "denied" }
  | { readonly status: "conflict" }
  | { readonly status: "recorded"; readonly receipt: Receipt }

export class DeploymentRepository extends Context.Service<
  DeploymentRepository,
  {
    readonly rotateBinding: (
      userId: string,
      scope: BindingScope,
      secretHash: string,
    ) => Effect.Effect<{ readonly id: string }, PersistenceError>
    readonly record: (
      input: Omit<Receipt, "projectId" | "receivedAt"> & {
        readonly secretHash: string
      },
    ) => Effect.Effect<RecordResult, PersistenceError>
    readonly read: (
      userId: string,
      projectId: string,
      bindingId: string,
      deploymentId: string,
    ) => Effect.Effect<
      {
        readonly receipt: Receipt
        readonly environment: string
        readonly service: string
      } | null,
      PersistenceError
    >
  }
>()("@flowmark/api/DeploymentRepository") {}
