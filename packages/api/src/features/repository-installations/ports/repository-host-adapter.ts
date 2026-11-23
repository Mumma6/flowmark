import type {
  BootstrapPullRequestFile,
  RepositoryWriterPermissionGrant,
} from "@flowmarkdev/core"
import { Context, type Effect } from "effect"
import type { RepositoryInstallationRejected } from "../errors.js"

export type UpsertBootstrapPullRequestRequest = Readonly<{
  readonly externalInstallationId: string
  readonly repository: string
  readonly branch: string
  readonly title: string
  readonly body: string
  readonly files: ReadonlyArray<BootstrapPullRequestFile>
  readonly permissions: RepositoryWriterPermissionGrant
}>

export type UpsertBootstrapPullRequestResult = Readonly<{
  readonly action: "created" | "updated"
  readonly branch: string
  readonly number: number
  readonly url: string
  readonly headSha: string
}>

export class RepositoryHostAdapter extends Context.Service<
  RepositoryHostAdapter,
  {
    readonly verifyWebhookSignature: (
      signatureHeader: string | null,
      rawBody: string,
    ) => Effect.Effect<void, RepositoryInstallationRejected>
    readonly upsertBootstrapPullRequest: (
      request: UpsertBootstrapPullRequestRequest,
    ) => Effect.Effect<
      UpsertBootstrapPullRequestResult,
      RepositoryInstallationRejected
    >
  }
>()("@flowmark/api/RepositoryHostAdapter") {}
