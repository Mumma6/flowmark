import assert from "node:assert/strict"
import { test } from "node:test"
import { paginate } from "./factory/collect.mjs"
import {
  summarize,
  renderLearning,
  validateDecisions,
} from "./factory/learning.mjs"

const pulls = [1, 2, 3].map((number) => ({
  number,
  head: { sha: `sha${number}` },
  html_url: `https://github.com/test/repo/pull/${number}`,
}))
const failure = (number) => ({
  path: ".github/workflows/pull-request.yml",
  conclusion: "failure",
  head_sha: `sha${number}`,
  pull_requests: [{ number }],
  html_url: `https://github.com/test/repo/actions/runs/${number}`,
})

test("repeated attempts in one PR do not manufacture cross-PR recurrence", () => {
  assert.deepEqual(
    summarize({
      pulls,
      runs: [failure(1), failure(1), failure(1)],
      reviews: [],
    }).recurring,
    [],
  )
  const result = summarize({
    pulls,
    runs: [failure(1), failure(2), failure(3), failure(3)],
    reviews: [],
  })
  assert.equal(result.recurring.length, 1)
  assert.equal(result.recurring[0].pullRequests.length, 3)
  assert.equal(result.recurring[0].pullRequests[2].evidence.length, 1)
})

test("successful/cancelled checks and unrelated PR failures are not learning findings", () => {
  const runs = [1, 2, 3].flatMap((number) =>
    ["success", "cancelled"].map((conclusion) => ({
      ...failure(number),
      conclusion,
    })),
  )
  assert.deepEqual(
    summarize({ pulls, runs: [...runs, failure(99)], reviews: [] }).recurring,
    [],
  )
})

test("fork workflow evidence without pull_requests can be associated by exact head SHA", () => {
  const runs = [1, 2, 3].map((number) => ({
    ...failure(number),
    pull_requests: [],
  }))
  assert.equal(summarize({ pulls, runs, reviews: [] }).recurring.length, 1)
})

test("review recurrence uses explicit stable identifiers; no semantic keyword guessing", () => {
  const reviews = pulls.map(({ number }) => ({
    number,
    body: "Please fix Effect. [factory:effect-runtime] [factory:effect-runtime]",
    html_url: `https://github.com/test/repo/pull/${number}#discussion_r1`,
  }))
  assert.equal(summarize({ pulls, runs: [], reviews }).recurring.length, 1)
  assert.deepEqual(
    summarize({
      pulls,
      runs: [],
      reviews: reviews.map((review) => ({
        ...review,
        body: "Please fix Effect",
      })),
    }).recurring,
    [],
  )
})

test("approved decisions suppress known proposals until expiry without hiding new categories", () => {
  const runs = [1, 2, 3].map(failure)
  const decision = {
    id: "ci:.github/workflows/pull-request.yml",
    status: "deferred",
    reason: "Tracked in TASK-001",
    until: "2026-12-01",
  }
  assert.deepEqual(
    summarize({
      pulls,
      runs,
      reviews: [],
      decisions: [decision],
      now: "2026-11-16T00:00:00Z",
    }).recurring,
    [],
  )
  assert.equal(
    summarize({
      pulls,
      runs,
      reviews: [],
      decisions: [decision],
      now: "2026-12-02T00:00:00Z",
    }).recurring.length,
    1,
  )
  assert.throws(() => validateDecisions([{ ...decision, reason: "" }]))
  assert.throws(() =>
    validateDecisions([{ ...decision, status: "auto-applied" }]),
  )
})

test("empty and partial reports state evidence limits and do not claim AI review", () => {
  const markdown = renderLearning({
    since: "2026-08-16",
    generatedAt: "2026-11-16",
    incomplete: ["Pagination limit reached"],
    ...summarize({ pulls: [], runs: [], reviews: [] }),
  })
  assert.match(markdown, /Partial evidence/)
  assert.match(markdown, /Hosted AI is off/)
  assert.match(markdown, /No new recurrence/)
})

test("pagination follows every page, honors sorted-window stops and marks hard limits", async () => {
  const visited = []
  const request = async (path) => {
    visited.push(path)
    return new URL(`https://example.com/${path}`).searchParams.get("page") ===
      "1"
      ? Array.from({ length: 100 }, (_, index) => index)
      : [100]
  }
  assert.equal(
    (await paginate({ request, path: "pulls?state=closed" })).length,
    101,
  )
  assert.equal(visited.length, 2)
  assert.match(visited[1], /&per_page=100&page=2$/)
  const partial = []
  assert.equal(
    (
      await paginate({
        request,
        path: "pulls",
        limit: 1,
        onLimit: (path) => partial.push(path),
      })
    ).length,
    100,
  )
  assert.deepEqual(partial, ["pulls"])
  visited.length = 0
  await paginate({ request, path: "pulls", stop: () => true })
  assert.equal(visited.length, 1)
  await assert.rejects(
    paginate({ request: async () => ({ bad: [] }), path: "pulls" }),
    /Unexpected/,
  )
  await assert.rejects(
    paginate({
      request: async () => {
        throw new Error("API unavailable")
      },
      path: "pulls",
    }),
    /unavailable/,
  )
})

test("historical runs match earlier PR commits without guessing from reused branch names", () => {
  const history = pulls.map((pull) => ({
    ...pull,
    commitShas: [`earlier${pull.number}`],
  }))
  const runs = pulls.map(({ number }) => ({
    ...failure(number),
    pull_requests: [],
    head_sha: `earlier${number}`,
  }))
  assert.equal(
    summarize({ pulls: history, runs, reviews: [] }).recurring.length,
    1,
  )
  assert.deepEqual(summarize({ pulls, runs, reviews: [] }).recurring, [])
})
