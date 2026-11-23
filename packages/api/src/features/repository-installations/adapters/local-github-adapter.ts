import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import {
  containsSecretMaterial,
  evaluateWriterPermissions,
  type BootstrapPullRequestFile,
} from "@flowmarkdev/core"
import { Array, Effect, Layer } from "effect"
import { RepositoryInstallationRejected } from "../errors.js"
import {
  RepositoryHostAdapter,
  type UpsertBootstrapPullRequestRequest,
  type UpsertBootstrapPullRequestResult,
} from "../ports/repository-host-adapter.js"

export function signGitHubWebhook(secret: string, rawBody: string): string {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex")
  return `sha256=${digest}`
}

export function verifyGitHubWebhookSignature(
  secret: string,
  signatureHeader: string | null,
  rawBody: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false
  }
  const expected = signGitHubWebhook(secret, rawBody)
  const left = Buffer.from(signatureHeader, "utf8")
  const right = Buffer.from(expected, "utf8")
  if (left.length !== right.length) {
    return false
  }
  return timingSafeEqual(left, right)
}

export type LocalGitHubPullRequestRecord = Readonly<{
  readonly externalInstallationId: string
  readonly repository: string
  readonly branch: string
  readonly number: number
  readonly url: string
  readonly headSha: string
  readonly title: string
  readonly body: string
  readonly files: ReadonlyArray<BootstrapPullRequestFile>
  readonly updateCount: number
  readonly merged: false
}>

export interface LocalGitHubFixtureOptions {
  readonly webhookSecret: string
  readonly authorizedRepositories?: ReadonlyMap<string, ReadonlySet<string>>
  readonly forbiddenSecretValues?: ReadonlyArray<string>
}

/**
 * Local GitHub adapter fixture for verifying install, repeat delivery, grant narrowing,
 * foreign-repository isolation and PR-only writer authority without hosted credentials.
 */
export function createLocalGitHubAdapter(options: LocalGitHubFixtureOptions) {
  const pullRequests = new Map<string, LocalGitHubPullRequestRecord>()
  const nextNumberByRepo = new Map<string, number>()

  const adapter = RepositoryHostAdapter.of({
    verifyWebhookSignature: (signatureHeader, rawBody) =>
      verifyGitHubWebhookSignature(
        options.webhookSecret,
        signatureHeader,
        rawBody,
      )
        ? Effect.void
        : Effect.fail(
            new RepositoryInstallationRejected({
              reason: "invalid-signature",
              detail: "Webhook delivery signature verification failed.",
            }),
          ),
    upsertBootstrapPullRequest: (request: UpsertBootstrapPullRequestRequest) =>
      Effect.suspend(() => {
        const permissionCheck = evaluateWriterPermissions(request.permissions)
        if (permissionCheck.status === "policy-escalation-rejected") {
          return Effect.fail(
            new RepositoryInstallationRejected({
              reason: "policy-escalation-rejected",
              detail: `PR writer cannot hold excess repository permissions: ${permissionCheck.excess.join(", ")}.`,
            }),
          )
        }
        if (permissionCheck.status === "grant-narrowed") {
          return Effect.fail(
            new RepositoryInstallationRejected({
              reason: "grant-narrowed",
              detail: `Repository installation grant is missing required permissions: ${permissionCheck.missing.join(", ")}.`,
            }),
          )
        }
        const allowedRepos = options.authorizedRepositories?.get(
          request.externalInstallationId,
        )
        if (allowedRepos && !allowedRepos.has(request.repository)) {
          return Effect.fail(
            new RepositoryInstallationRejected({
              reason: "foreign-repository",
              detail: `Installation ${request.externalInstallationId} is not authorized for ${request.repository}.`,
            }),
          )
        }
        const combined = [
          request.title,
          request.body,
          ...Array.map(request.files, (file) => file.content),
        ].join("\n")
        if (containsSecretMaterial(combined, options.forbiddenSecretValues)) {
          return Effect.fail(
            new RepositoryInstallationRejected({
              reason: "secret-leak-blocked",
              detail: "Bootstrap PR content must not contain secret values.",
            }),
          )
        }
        const key = `${request.externalInstallationId}::${request.repository}::${request.branch}`
        const existing = pullRequests.get(key)
        const updateCount = (existing?.updateCount ?? 0) + 1
        const number =
          existing?.number ??
          (nextNumberByRepo.get(request.repository) ?? 0) + 1
        nextNumberByRepo.set(
          request.repository,
          Math.max(nextNumberByRepo.get(request.repository) ?? 0, number),
        )
        const headSha = createHash("sha256")
          .update(`${key}:${updateCount}:${combined}`)
          .digest("hex")
          .slice(0, 40)
        const url = `https://github.com/${request.repository}/pull/${number}`
        const record: LocalGitHubPullRequestRecord = {
          externalInstallationId: request.externalInstallationId,
          repository: request.repository,
          branch: request.branch,
          number,
          url,
          headSha,
          title: request.title,
          body: request.body,
          files: request.files,
          updateCount,
          merged: false,
        }
        pullRequests.set(key, record)
        return Effect.succeed({
          action: existing ? "updated" : "created",
          branch: record.branch,
          number: record.number,
          url: record.url,
          headSha: record.headSha,
        } satisfies UpsertBootstrapPullRequestResult)
      }),
  })

  return {
    adapter,
    layer: Layer.succeed(RepositoryHostAdapter, adapter),
    listPullRequests: () => Array.fromIterable(pullRequests.values()),
    sign: (rawBody: string) =>
      signGitHubWebhook(options.webhookSecret, rawBody),
  }
}

/**
 * Default runtime adapter when hosted GitHub App credentials have not been provisioned.
 * Verifies webhook signatures only if FLOWMARK_GITHUB_WEBHOOK_SECRET is configured,
 * and explicitly refuses unconfigured outbound PR writes.
 */
export const UnconfiguredRepositoryHostAdapterLive = Layer.succeed(
  RepositoryHostAdapter,
  RepositoryHostAdapter.of({
    verifyWebhookSignature: (signatureHeader, rawBody) => {
      const secret = process.env.FLOWMARK_GITHUB_WEBHOOK_SECRET?.trim()
      if (!secret) {
        return Effect.fail(
          new RepositoryInstallationRejected({
            reason: "host-unconfigured",
            detail:
              "GitHub installation webhook secret is not configured in this environment.",
          }),
        )
      }
      return verifyGitHubWebhookSignature(secret, signatureHeader, rawBody)
        ? Effect.void
        : Effect.fail(
            new RepositoryInstallationRejected({
              reason: "invalid-signature",
              detail: "Webhook delivery signature verification failed.",
            }),
          )
    },
    upsertBootstrapPullRequest: () =>
      Effect.fail(
        new RepositoryInstallationRejected({
          reason: "host-unconfigured",
          detail:
            "GitHub repository PR adapter is not configured in this environment.",
        }),
      ),
  }),
)
