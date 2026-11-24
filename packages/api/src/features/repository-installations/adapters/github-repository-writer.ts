import { createSign } from "node:crypto"
import {
  containsSecretMaterial,
  evaluateWriterPermissions,
} from "@flowmarkdev/core"
import { Array, Effect, Layer, Option } from "effect"
import { RepositoryInstallationRejected } from "../errors.js"
import {
  RepositoryHostAdapter,
  type UpsertBootstrapPullRequestRequest,
  type UpsertBootstrapPullRequestResult,
} from "../ports/repository-host-adapter.js"
import {
  UnconfiguredRepositoryHostAdapterLive,
  verifyGitHubWebhookSignature,
} from "./local-github-adapter.js"

const githubApi = "https://api.github.com"

export type GitHubHttpRequest = Readonly<{
  readonly method: "GET" | "POST" | "PUT" | "PATCH"
  readonly path: string
  readonly token: string
  readonly body?: unknown
}>

export type GitHubHttpResponse = Readonly<{
  readonly status: number
  readonly body: unknown
}>

export type GitHubHttpClient = (
  request: GitHubHttpRequest,
) => Effect.Effect<GitHubHttpResponse, RepositoryInstallationRejected, never>

const providerFailure = (detail: string) =>
  new RepositoryInstallationRejected({
    reason: "verification-failed",
    detail,
  })

const base64Url = (value: string) =>
  Buffer.from(value, "utf8").toString("base64url")

export function gitHubAppJwt(
  appId: string,
  privateKey: string,
  now = Date.now(),
) {
  const encoded = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(
    JSON.stringify({
      iat: Math.floor(now / 1000) - 60,
      exp: Math.floor(now / 1000) + 9 * 60,
      iss: appId,
    }),
  )}`
  const signer = createSign("RSA-SHA256")
  signer.update(encoded)
  signer.end()
  return `${encoded}.${signer.sign(privateKey).toString("base64url")}`
}

const record = (body: unknown) =>
  body !== null && typeof body === "object"
    ? (body as Readonly<Record<string, unknown>>)
    : null

const text = (body: unknown, key: string) => {
  const value = record(body)?.[key]
  return typeof value === "string" && value.length > 0 ? value : null
}

const numberValue = (body: unknown, key: string) => {
  const value = record(body)?.[key]
  return typeof value === "number" && Number.isInteger(value) ? value : null
}

const requireText = (body: unknown, key: string) => {
  const value = text(body, key)
  return value === null
    ? Effect.fail(
        providerFailure(
          "GitHub returned a response outside the expected shape.",
        ),
      )
    : Effect.succeed(value)
}

const requestGitHub = (client: GitHubHttpClient, request: GitHubHttpRequest) =>
  client(request).pipe(
    Effect.flatMap((response) =>
      response.status >= 200 && response.status < 300
        ? Effect.succeed(response)
        : Effect.fail(
            response.status === 404
              ? new RepositoryInstallationRejected({
                  reason: "foreign-repository",
                  detail:
                    "GitHub could not find that repository for this installation.",
                })
              : response.status === 401 || response.status === 403
                ? new RepositoryInstallationRejected({
                    reason: "grant-narrowed",
                    detail: "GitHub refused the repository writer credential.",
                  })
                : providerFailure("GitHub refused the bootstrap write."),
          ),
    ),
  )

const optional = (
  effect: Effect.Effect<GitHubHttpResponse, RepositoryInstallationRejected>,
) =>
  effect.pipe(
    Effect.map((response) => Option.some(response)),
    Effect.catchTag("RepositoryInstallationRejected", (error) =>
      error.reason === "foreign-repository"
        ? Effect.succeed(Option.none<GitHubHttpResponse>())
        : Effect.fail(error),
    ),
  )

const encodedPath = (filePath: string) =>
  filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")

export function createGitHubRepositoryWriter(options: {
  readonly appId: string
  readonly webhookSecret: string
  readonly createJwt: () => string
  readonly request: GitHubHttpClient
}) {
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
    upsertBootstrapPullRequest: (request) =>
      Effect.gen(function* () {
        const rejected = rejectBeforeWrite(request)
        if (rejected) {
          return yield* rejected
        }
        const [owner, repository] = request.repository.split("/")
        if (
          !owner ||
          !repository ||
          request.repository.split("/").length !== 2
        ) {
          return yield* new RepositoryInstallationRejected({
            reason: "foreign-repository",
            detail: "Repository must be owner/name.",
          })
        }
        if (!/^\d+$/.test(request.externalInstallationId)) {
          return yield* new RepositoryInstallationRejected({
            reason: "installation-not-found",
            detail: "GitHub installation id must be numeric.",
          })
        }
        const jwt = options.createJwt()
        const tokenResponse = yield* requestGitHub(options.request, {
          method: "POST",
          path: `/app/installations/${request.externalInstallationId}/access_tokens`,
          token: jwt,
        })
        const token = yield* requireText(tokenResponse.body, "token")
        const repoResponse = yield* requestGitHub(options.request, {
          method: "GET",
          path: `/repos/${owner}/${repository}`,
          token,
        })
        const defaultBranch = yield* requireText(
          repoResponse.body,
          "default_branch",
        )
        const baseRef = yield* requestGitHub(options.request, {
          method: "GET",
          path: `/repos/${owner}/${repository}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
          token,
        })
        const baseSha = yield* requireText(record(baseRef.body)?.object, "sha")
        const existingBranch = yield* optional(
          requestGitHub(options.request, {
            method: "GET",
            path: `/repos/${owner}/${repository}/git/ref/heads/${encodeURIComponent(request.branch)}`,
            token,
          }),
        )
        if (Option.isNone(existingBranch)) {
          yield* requestGitHub(options.request, {
            method: "POST",
            path: `/repos/${owner}/${repository}/git/refs`,
            token,
            body: {
              ref: `refs/heads/${request.branch}`,
              sha: baseSha,
            },
          })
        }
        yield* Effect.forEach(request.files, (file) =>
          Effect.gen(function* () {
            const current = yield* optional(
              requestGitHub(options.request, {
                method: "GET",
                path: `/repos/${owner}/${repository}/contents/${encodedPath(file.path)}?ref=${encodeURIComponent(request.branch)}`,
                token,
              }),
            )
            const sha = Option.match(current, {
              onNone: () => undefined,
              onSome: (response) => text(response.body, "sha") ?? undefined,
            })
            yield* requestGitHub(options.request, {
              method: "PUT",
              path: `/repos/${owner}/${repository}/contents/${encodedPath(file.path)}`,
              token,
              body: {
                message: `chore(flowmark): ${file.path}`,
                content: Buffer.from(file.content, "utf8").toString("base64"),
                branch: request.branch,
                ...(sha ? { sha } : {}),
              },
            })
          }),
        )
        const headRef = yield* requestGitHub(options.request, {
          method: "GET",
          path: `/repos/${owner}/${repository}/git/ref/heads/${encodeURIComponent(request.branch)}`,
          token,
        })
        const headSha = yield* requireText(record(headRef.body)?.object, "sha")
        const listed = yield* requestGitHub(options.request, {
          method: "GET",
          path: `/repos/${owner}/${repository}/pulls?head=${encodeURIComponent(`${owner}:${request.branch}`)}&state=open`,
          token,
        })
        const pulls = Array.isArray(listed.body) ? listed.body : null
        if (!pulls) {
          return yield* providerFailure(
            "GitHub returned a response outside the expected shape.",
          )
        }
        const currentPull = record(pulls[0])
        const currentNumber = currentPull
          ? numberValue(currentPull, "number")
          : null
        const saved = yield* requestGitHub(options.request, {
          method: currentNumber === null ? "POST" : "PATCH",
          path:
            currentNumber === null
              ? `/repos/${owner}/${repository}/pulls`
              : `/repos/${owner}/${repository}/pulls/${currentNumber}`,
          token,
          body:
            currentNumber === null
              ? {
                  title: request.title,
                  body: request.body,
                  head: request.branch,
                  base: defaultBranch,
                }
              : { title: request.title, body: request.body },
        })
        const pullNumber = numberValue(saved.body, "number")
        const pullUrl = text(saved.body, "html_url")
        if (pullNumber === null || pullUrl === null) {
          return yield* providerFailure(
            "GitHub returned a response outside the expected shape.",
          )
        }
        return {
          action: currentNumber === null ? "created" : "updated",
          branch: request.branch,
          number: pullNumber,
          url: pullUrl,
          headSha,
        } satisfies UpsertBootstrapPullRequestResult
      }),
  })
  return { adapter, layer: Layer.succeed(RepositoryHostAdapter, adapter) }
}

const rejectBeforeWrite = (request: UpsertBootstrapPullRequestRequest) => {
  const permissionCheck = evaluateWriterPermissions(request.permissions)
  if (permissionCheck.status === "policy-escalation-rejected") {
    return new RepositoryInstallationRejected({
      reason: "policy-escalation-rejected",
      detail: `PR writer cannot hold excess repository permissions: ${permissionCheck.excess.join(", ")}.`,
    })
  }
  if (permissionCheck.status === "grant-narrowed") {
    return new RepositoryInstallationRejected({
      reason: "grant-narrowed",
      detail: `Repository installation grant is missing required permissions: ${permissionCheck.missing.join(", ")}.`,
    })
  }
  const combined = [
    request.title,
    request.body,
    ...Array.map(request.files, (file) => file.content),
  ].join("\n")
  if (containsSecretMaterial(combined)) {
    return new RepositoryInstallationRejected({
      reason: "secret-leak-blocked",
      detail: "Bootstrap PR content must not contain secret values.",
    })
  }
  return null
}

export const liveGitHubHttpClient: GitHubHttpClient = (request) =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(`${githubApi}${request.path}`, {
        method: request.method,
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${request.token}`,
          "user-agent": "flowmark",
          "x-github-api-version": "2022-11-28",
          ...(request.body === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
      })
      const text = await response.text()
      return {
        status: response.status,
        body: text.length === 0 ? null : (JSON.parse(text) as unknown),
      }
    },
    catch: () => providerFailure("GitHub request could not be completed."),
  })

export type GitHubWriterConfig = Readonly<{
  readonly appId: string
  readonly privateKey: string
  readonly webhookSecret: string
}>

/** A write adapter exists only when the app id, private key and webhook secret are all present. */
export function readGitHubWriterConfig(
  env: Readonly<Record<string, string | undefined>>,
): GitHubWriterConfig | null {
  const appId = env.FLOWMARK_GITHUB_APP_ID?.trim() ?? ""
  const privateKey = (env.FLOWMARK_GITHUB_APP_PRIVATE_KEY ?? "")
    .trim()
    .replaceAll("\\n", "\n")
  const webhookSecret = env.FLOWMARK_GITHUB_WEBHOOK_SECRET?.trim() ?? ""
  if (
    !/^\d+$/.test(appId) ||
    !privateKey.includes("PRIVATE KEY") ||
    webhookSecret.length < 16
  ) {
    return null
  }
  return { appId, privateKey, webhookSecret }
}

export function repositoryHostAdapterLayer(
  env: Readonly<Record<string, string | undefined>>,
) {
  const config = readGitHubWriterConfig(env)
  if (!config) {
    return UnconfiguredRepositoryHostAdapterLive
  }
  return createGitHubRepositoryWriter({
    appId: config.appId,
    webhookSecret: config.webhookSecret,
    createJwt: () => gitHubAppJwt(config.appId, config.privateKey),
    request: liveGitHubHttpClient,
  }).layer
}
