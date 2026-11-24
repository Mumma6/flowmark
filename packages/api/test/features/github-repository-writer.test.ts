import { Effect, Result } from "effect"
import { describe, expect, it } from "vitest"
import {
  createGitHubRepositoryWriter,
  readGitHubWriterConfig,
  repositoryHostAdapterLayer,
  type GitHubHttpRequest,
  type GitHubHttpResponse,
} from "../../src/features/repository-installations/adapters/github-repository-writer.js"
import { signGitHubWebhook } from "../../src/features/repository-installations/adapters/local-github-adapter.js"
import { RepositoryHostAdapter } from "../../src/features/repository-installations/ports/repository-host-adapter.js"

const permissions = {
  contents: "write" as const,
  pullRequests: "write" as const,
  metadata: "read" as const,
}

const plan = {
  externalInstallationId: "42",
  repository: "example/bookings",
  branch: "flowmark/connect-worker-production",
  title: "Connect Flowmark",
  body: "Bootstrap files.",
  files: [{ path: ".flowmark/install.json", content: "{}\n" }],
  permissions,
}

const scripted = (responses: ReadonlyArray<GitHubHttpResponse>) => {
  const calls: GitHubHttpRequest[] = []
  const request = (input: GitHubHttpRequest) => {
    calls.push(input)
    const response = responses[calls.length - 1]
    if (!response) {
      return Effect.die("Missing scripted GitHub response")
    }
    return Effect.succeed(response)
  }
  return { calls, request }
}

const writer = (responses: ReadonlyArray<GitHubHttpResponse>) => {
  const http = scripted(responses)
  return {
    ...http,
    run: (effect: Effect.Effect<unknown, unknown, RepositoryHostAdapter>) =>
      Effect.runPromise(
        Effect.result(effect).pipe(
          Effect.provide(
            createGitHubRepositoryWriter({
              appId: "1",
              webhookSecret: "webhook-secret-value",
              createJwt: () => "test-jwt",
              request: http.request,
            }).layer,
          ),
        ),
      ),
  }
}

const createdResponses = (): GitHubHttpResponse[] => [
  { status: 201, body: { token: "installation-token" } },
  { status: 200, body: { default_branch: "main" } },
  { status: 200, body: { object: { sha: "base-sha" } } },
  { status: 404, body: {} },
  { status: 201, body: {} },
  { status: 404, body: {} },
  { status: 201, body: {} },
  { status: 200, body: { object: { sha: "head-sha" } } },
  { status: 200, body: [] },
  {
    status: 201,
    body: { number: 7, html_url: "https://github.com/example/bookings/pull/7" },
  },
]

describe("GitHub repository writer", () => {
  it("creates a pull request and updates the same one on the next call", async () => {
    const first = writer(createdResponses())
    const created = await first.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.upsertBootstrapPullRequest(plan),
      ),
    )
    expect(Result.isSuccess(created)).toBe(true)
    if (Result.isFailure(created)) {
      return
    }
    expect(created.success).toMatchObject({
      action: "created",
      number: 7,
      headSha: "head-sha",
    })
    expect(first.calls.some((call) => call.method === "PUT")).toBe(true)

    const second = writer([
      { status: 201, body: { token: "installation-token" } },
      { status: 200, body: { default_branch: "main" } },
      { status: 200, body: { object: { sha: "base-sha" } } },
      { status: 200, body: { object: { sha: "existing-head" } } },
      { status: 200, body: { sha: "file-sha" } },
      { status: 200, body: {} },
      { status: 200, body: { object: { sha: "next-head" } } },
      {
        status: 200,
        body: [
          {
            number: 7,
            html_url: "https://github.com/example/bookings/pull/7",
          },
        ],
      },
      {
        status: 200,
        body: {
          number: 7,
          html_url: "https://github.com/example/bookings/pull/7",
        },
      },
    ])
    const updated = await second.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.upsertBootstrapPullRequest(plan),
      ),
    )
    expect(Result.isSuccess(updated)).toBe(true)
    if (Result.isSuccess(updated)) {
      expect(updated.success).toMatchObject({ action: "updated", number: 7 })
    }
    expect(second.calls.some((call) => call.method === "PATCH")).toBe(true)
    expect(
      second.calls.some(
        (call) => call.method === "POST" && call.path.endsWith("/pulls"),
      ),
    ).toBe(false)
  })

  it("rejects excess permissions, a foreign repository and a leaked secret before a write", async () => {
    const excess = writer([])
    const escalated = await excess.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.upsertBootstrapPullRequest({
          ...plan,
          permissions: { ...permissions, canMerge: true },
        }),
      ),
    )
    expect(Result.isFailure(escalated)).toBe(true)
    expect(excess.calls).toHaveLength(0)

    const missing = writer([
      { status: 201, body: { token: "installation-token" } },
      { status: 404, body: {} },
    ])
    const foreign = await missing.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.upsertBootstrapPullRequest(plan),
      ),
    )
    expect(Result.isFailure(foreign)).toBe(true)
    if (Result.isFailure(foreign)) {
      expect(foreign.failure).toMatchObject({ reason: "foreign-repository" })
    }
    expect(missing.calls.some((call) => call.method === "PUT")).toBe(false)

    const leaked = writer([])
    const secret = await leaked.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.upsertBootstrapPullRequest({
          ...plan,
          body: `token fmd_${"ab".repeat(16)}`,
        }),
      ),
    )
    expect(Result.isFailure(secret)).toBe(true)
    expect(leaked.calls).toHaveLength(0)
  })

  it("does not report a pull request when GitHub refuses the file write", async () => {
    const http = writer([
      ...createdResponses().slice(0, 6),
      { status: 500, body: {} },
    ])
    const failed = await http.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.upsertBootstrapPullRequest(plan),
      ),
    )
    expect(Result.isFailure(failed)).toBe(true)
    if (Result.isFailure(failed)) {
      expect(failed.failure).toMatchObject({ reason: "verification-failed" })
    }
    expect(http.calls.some((call) => call.path.endsWith("/pulls"))).toBe(false)
  })

  it("checks webhook signatures locally and stays unconfigured without a complete credential set", async () => {
    const http = writer([])
    const body = '{"ok":true}'
    const signed = signGitHubWebhook("webhook-secret-value", body)
    const accepted = await http.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.verifyWebhookSignature(signed, body),
      ),
    )
    const rejected = await http.run(
      Effect.flatMap(RepositoryHostAdapter, (adapter) =>
        adapter.verifyWebhookSignature("sha256=00", body),
      ),
    )
    expect(Result.isSuccess(accepted)).toBe(true)
    expect(Result.isFailure(rejected)).toBe(true)
    expect(readGitHubWriterConfig({})).toBeNull()
    expect(
      readGitHubWriterConfig({
        FLOWMARK_GITHUB_APP_ID: "1",
        FLOWMARK_GITHUB_WEBHOOK_SECRET: "webhook-secret-value",
      }),
    ).toBeNull()
    const unconfigured = await Effect.runPromise(
      Effect.result(
        Effect.flatMap(RepositoryHostAdapter, (adapter) =>
          adapter.upsertBootstrapPullRequest(plan),
        ),
      ).pipe(Effect.provide(repositoryHostAdapterLayer({}))),
    )
    expect(Result.isFailure(unconfigured)).toBe(true)
    if (Result.isFailure(unconfigured)) {
      expect(unconfigured.failure).toMatchObject({
        reason: "host-unconfigured",
      })
    }
  })
})
