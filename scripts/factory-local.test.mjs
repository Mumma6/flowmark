import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import {
  applyResult,
  captureMerges,
  withStateLock,
  initialState,
  planJobs,
  readState,
  validateDecisions,
  validateResult,
  validateSource,
  weekKey,
  writeJson,
} from "./factory/local-state.mjs"
import {
  apiPath,
  collectHistory,
  collectDiscussion,
  failureEvidence,
  collection,
  publishReview,
  readSource,
  reviewComment,
  safeSourcePath,
  treePaths,
} from "./factory/local-github.mjs"
import { paginate } from "./factory/collect.mjs"

const sha = "a".repeat(40)
const now = "2026-11-16T12:00:00.000Z"
const pull = (number, state = "open") => ({
  number,
  state,
  draft: false,
  head: { sha },
  base: { sha, ref: "staging" },
  merged_at: state === "closed" ? now : null,
  merge_commit_sha: sha,
  html_url: `https://github.com/Mumma6/flowmark/pull/${number}`,
  title: "Example change",
})
const job = (kind = "review", number = 1) => ({
  kind,
  number,
  key: `${kind}:${number}:${sha}`,
  sha,
  inventory: ["packages/api/src/read.ts", "AGENTS.md"],
  ruleFiles: ["AGENTS.md"],
  history: [1, 2, 3].map((number) => ({
    number,
    evidence: [
      {
        url: pull(number).html_url,
        text: "Confirmed boundary failure in application helper",
      },
    ],
  })),
})
const result = (candidate = job()) => ({
  version: 1,
  jobKey: candidate.key,
  coverage: "complete",
  summary: "Inspected the changed boundary.",
  findings: [],
  lessons: [],
})
const finding = () => ({
  id: "runtime-boundary",
  category: "architecture",
  file: "packages/api/src/read.ts",
  line: 2,
  evidence: "Effect.runPromise(work)",
  ruleFile: "AGENTS.md",
  impact: "The helper executes before its caller controls the scope.",
  suggestion: "Return the lazy effect to the caller.",
})
const lesson = (numbers = [1]) => ({
  id: "runtime-boundary",
  title: "Clarify runtime ownership",
  observation: "The same helper-boundary failure recurs.",
  target: "AGENTS.md",
  suggestedChange: "Add the actual request-boundary example.",
  benefit: "Avoid repeated execution inside helpers.",
  verification: "Add a focused regression fixture.",
  evidence: numbers.map((number) => ({
    number,
    url: pull(number).html_url,
    quote: "Confirmed boundary failure",
  })),
})

test("planner handles new heads/merges, drafts, offline catch-up and one weekly scope without starvation", () => {
  const state = initialState()
  const jobs = planJobs({
    pulls: [pull(1), { ...pull(2), draft: true }, pull(3, "closed")],
    state,
    now,
    stagingSha: sha,
    owners: ["packages/api"],
  })
  assert.deepEqual(
    jobs.map((candidate) => candidate.kind),
    ["review", "retrospective", "health"],
  )
  jobs.forEach((candidate) => {
    state.processed[candidate.key] = { at: now }
  })
  assert.deepEqual(
    planJobs({
      pulls: [pull(1), pull(3, "closed")],
      state,
      now,
      stagingSha: sha,
      owners: ["packages/api"],
    }),
    [],
  )
  const changed = { ...pull(1), head: { sha: "b".repeat(40) } }
  assert.equal(
    planJobs({
      pulls: [changed],
      state,
      now,
      stagingSha: sha,
      owners: ["packages/api"],
    })[0].kind,
    "review",
  )
  assert.equal(weekKey("2026-11-22T23:59:00Z"), "2026-11-16")
  assert.equal(weekKey("2026-11-23T00:00:00Z"), "2026-11-23")
  assert.equal(
    planJobs({
      pulls: [{ ...pull(9, "closed"), merged_at: "2026-10-01T00:00:00Z" }],
      state: initialState(),
      now,
      stagingSha: sha,
      owners: ["packages/api"],
    }).length,
    1,
  )
})

test("strict result boundary rejects invented paths, wrong jobs, private text and fabricated learning evidence", () => {
  const candidate = job()
  assert.equal(
    validateResult(result(candidate), candidate).coverage,
    "complete",
  )
  assert.throws(() =>
    validateResult({ ...result(), jobKey: "different" }, candidate),
  )
  assert.throws(() => validateResult({ ...result(), extra: true }, candidate))
  assert.throws(() =>
    validateResult(
      { ...result(), summary: "See private/plans/secret.md" },
      candidate,
    ),
  )
  assert.throws(() =>
    validateResult(
      { ...result(), findings: [{ ...finding(), file: "../secret" }] },
      candidate,
    ),
  )
  assert.throws(() =>
    validateResult(
      { ...result(), findings: [{ ...finding(), ruleFile: "invented.md" }] },
      candidate,
    ),
  )
  assert.throws(() =>
    validateResult(
      { ...result(), findings: [{ ...finding(), line: 0 }] },
      candidate,
    ),
  )
  const retrospective = job("retrospective")
  assert.equal(
    validateResult(
      { ...result(retrospective), lessons: [lesson()] },
      retrospective,
    ).lessons.length,
    1,
  )
  assert.throws(() =>
    validateResult(
      {
        ...result(retrospective),
        lessons: [
          {
            ...lesson(),
            evidence: [
              {
                number: 1,
                url: pull(1).html_url,
                quote: "Invented reviewer statement",
              },
            ],
          },
        ],
      },
      retrospective,
    ),
  )
  assert.throws(() =>
    validateResult(
      { ...result(retrospective), lessons: [lesson([2])] },
      retrospective,
    ),
  )
  assert.throws(() =>
    validateResult({ ...result(), lessons: [lesson()] }, candidate),
  )
})

test("finding source checks require real evidence near the cited public line", () => {
  assert.doesNotThrow(() =>
    validateSource(
      finding(),
      "export const read = () => {\nEffect.runPromise(work)\n}",
    ),
  )
  assert.throws(() => validateSource(finding(), "const read = lazyWork"))
  assert.throws(() =>
    validateSource({ ...finding(), line: 99 }, "Effect.runPromise(work)"),
  )
})

test("learning accumulates distinct PR evidence, proposes once, and preserves decisions and partial coverage", () => {
  let state = initialState()
  const first = job("retrospective", 1)
  const observed = {
    ...result(first),
    coverage: "partial",
    lessons: [lesson()],
  }
  let applied = applyResult(state, first, observed, [], now)
  assert.equal(applied.proposals.length, 0)
  assert.equal(applied.state.processed[first.key].coverage, "partial")
  assert.equal(
    applyResult(applied.state, first, observed, [], now).duplicate,
    true,
  )
  state = applied.state
  const second = job("retrospective", 2)
  state = applyResult(
    state,
    second,
    { ...result(second), lessons: [lesson([2])] },
    [],
    now,
  ).state
  const third = job("retrospective", 3)
  applied = applyResult(
    state,
    third,
    { ...result(third), lessons: [lesson([3])] },
    [],
    now,
  )
  assert.equal(applied.proposals.length, 1)
  assert.equal(applied.proposals[0].prs.length, 3)
  const fourth = job("retrospective", 4)
  assert.equal(
    applyResult(
      applied.state,
      fourth,
      { ...result(fourth), lessons: [lesson([1, 2, 3])] },
      [],
      now,
    ).proposals.length,
    0,
  )
  const decision = {
    id: "runtime-boundary",
    status: "rejected",
    reason: "The existing rule is sufficient",
    until: "2026-12-01",
  }
  assert.equal(
    applyResult(
      initialState(),
      third,
      { ...result(third), lessons: [lesson([1, 2, 3])] },
      validateDecisions([decision]),
      now,
    ).proposals.length,
    0,
  )
  assert.throws(() => validateDecisions([{ ...decision, reason: "" }]))
  assert.throws(() =>
    validateDecisions([{ ...decision, status: "auto-applied" }]),
  )
  assert.equal(
    applyResult(
      initialState(),
      third,
      { ...result(third), lessons: [lesson([1, 2, 3])] },
      [decision],
      "2026-12-02T00:00:00Z",
    ).proposals.length,
    1,
  )
})

test("atomic private memory survives restart without silently resetting corrupt state", () => {
  const directory = mkdtempSync(join(tmpdir(), "flowmark-factory-"))
  try {
    assert.deepEqual(readState(directory), initialState())
    const state = applyResult(initialState(), job(), result(), [], now).state
    writeJson(join(directory, "memory.json"), state)
    assert.deepEqual(readState(directory), state)
    assert.equal(
      JSON.parse(readFileSync(join(directory, "memory.json"), "utf8")).version,
      1,
    )
    writeJson(join(directory, "memory.json"), { version: 99 })
    assert.throws(() => readState(directory), /preserve/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("public source helper rejects traversal and mutable refs, and fails on incomplete trees", () => {
  assert.equal(safeSourcePath("../.env"), false)
  assert.equal(safeSourcePath("private/secret.md"), false)
  assert.equal(safeSourcePath("packages/api/src/read.ts"), true)
  const request = () => ({
    type: "file",
    encoding: "base64",
    size: 4,
    content: Buffer.from("code").toString("base64"),
  })
  assert.equal(readSource(sha, "packages/api/src/read.ts", request), "code")
  assert.throws(
    () =>
      readSource(sha, "image.png", () => ({
        ...request(),
        content: Buffer.from([0, 255]).toString("base64"),
      })),
    /Binary/,
  )
  assert.throws(() => readSource("staging", "AGENTS.md", request))
  assert.throws(() => readSource(sha, "private/config", request))
  assert.throws(() => treePaths(sha, () => ({ truncated: true, tree: [] })))
})

test("publisher ignores stale heads, never posts all-clear comments and updates only its own comment", async () => {
  const candidate = job()
  const writes = []
  let current = { ...pull(1), head: { sha: "b".repeat(40) } }
  let comments = []
  const request = (path, options) => {
    if (options?.method) {
      writes.push({ path, ...options })
      return {}
    }
    if (path === apiPath("pulls/1")) {
      return current
    }
    if (path.startsWith(apiPath("issues/1/comments"))) {
      return comments
    }
    if (path === "user") {
      return { login: "maintainer" }
    }
    throw new Error(`Unexpected test request ${path}`)
  }
  assert.equal(
    (
      await publishReview(
        candidate,
        { ...result(), findings: [finding()] },
        request,
      )
    ).status,
    "stale",
  )
  assert.equal(writes.length, 0)
  current = pull(1)
  assert.equal(
    (await publishReview(candidate, result(), request)).status,
    "quiet",
  )
  assert.equal(writes.length, 0)
  const found = { ...result(), findings: [finding()] }
  assert.equal(
    (await publishReview(candidate, found, request)).status,
    "published",
  )
  assert.equal(writes[0].method, "POST")
  const body = reviewComment(candidate, found)
  comments = [{ id: 7, body, user: { login: "maintainer" } }]
  assert.equal((await publishReview(candidate, found, request)).status, "quiet")
  assert.equal(writes.length, 1)
  assert.equal(
    (
      await publishReview(
        candidate,
        { ...result(), coverage: "partial" },
        request,
      )
    ).status,
    "partial-local-only",
  )
  assert.equal(writes.length, 1)
  await publishReview(candidate, result(), request)
  assert.equal(writes[1].method, "PATCH")
  assert.equal(writes[1].path, apiPath("issues/comments/7"))
  comments = [{ id: 8, body, user: { login: "someone-else" } }]
  await publishReview(candidate, found, request)
  assert.equal(writes.at(-1).method, "POST")
})

test("a head changing between validation and publication prevents writes", async () => {
  let reads = 0
  let writes = 0
  const request = (path, options) => {
    if (options?.method) {
      writes += 1
      return {}
    }
    if (path === apiPath("pulls/1")) {
      return ++reads === 1
        ? pull(1)
        : { ...pull(1), head: { sha: "b".repeat(40) } }
    }
    return []
  }
  assert.equal(
    (
      await publishReview(
        job(),
        { ...result(), findings: [finding()] },
        request,
      )
    ).status,
    "stale",
  )
  assert.equal(writes, 0)
})

test("retrospective collection excludes self-corroborating factory comments and bounds context", async () => {
  const request = (path) =>
    path.includes("/files?")
      ? [{ patch: "Real changed rule" }]
      : path.includes("/comments?")
        ? [
            {
              body: "<!-- flowmark-factory-local -->generated opinion",
              html_url: "own",
            },
            { body: "A human confirmed the defect", html_url: "human" },
          ]
        : []
  const history = await collectHistory(pull(1, "closed"), request)
  assert.equal(
    history.evidence.some((item) => item.url === "own"),
    false,
  )
  assert.equal(
    history.evidence.some((item) => item.url === "human"),
    true,
  )
  assert.equal(
    history.evidence.reduce((sum, item) => sum + item.text.length, 0) <= 12000,
    true,
  )
})

test("pagination reads every page, respects sorted-window stops and exposes hard caps/errors", async () => {
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
  await assert.rejects(collection("pulls", request, 1), /Incomplete/)
  visited.length = 0
  await paginate({ request, path: "pulls", stop: () => true })
  assert.equal(visited.length, 1)
  await assert.rejects(
    paginate({ request: async () => ({ invalid: [] }), path: "pulls" }),
    /Unexpected/,
  )
})

test("durable merge backlog survives offline windows and does not requeue completed merges", () => {
  const first = pull(1, "closed")
  const captured = captureMerges(
    initialState(),
    [first],
    "2026-11-01T00:00:00Z",
    now,
  )
  assert.equal(captured.lastPollAt, now)
  assert.equal(Object.values(captured.pendingMerges).length, 1)
  const later = "2027-01-01T00:00:00Z"
  assert.equal(
    planJobs({
      pulls: Object.values(captured.pendingMerges),
      state: captured,
      now: later,
      stagingSha: sha,
      owners: ["packages/api"],
      mergeSince: "1970-01-01T00:00:00Z",
    }).some((candidate) => candidate.kind === "retrospective"),
    true,
  )
  const retrospective = job("retrospective")
  const completed = applyResult(
    captured,
    retrospective,
    result(retrospective),
    [],
    later,
  ).state
  assert.equal(Object.keys(completed.pendingMerges).length, 0)
  assert.equal(
    Object.keys(
      captureMerges(completed, [first], "2026-11-01T00:00:00Z", later)
        .pendingMerges,
    ).length,
    0,
  )
})

test("shared polling/completion lock preserves another run's ownership and releases its own", async () => {
  const directory = mkdtempSync(join(tmpdir(), "flowmark-factory-lock-"))
  try {
    await withStateLock(directory, async () => {
      const owner = readFileSync(
        join(directory, "record.lock/owner.json"),
        "utf8",
      )
      await assert.rejects(
        withStateLock(directory, () => 1),
        /owning run/,
      )
      assert.equal(
        readFileSync(join(directory, "record.lock/owner.json"), "utf8"),
        owner,
      )
    })
    await assert.rejects(
      withStateLock(directory, () => {
        throw new Error("deliberate interruption")
      }),
      /interruption/,
    )
    assert.equal(await withStateLock(directory, () => 3), 3)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("earlier commit identities retain real failure evidence and annotations stay within the repository", async () => {
  const request = (path) => {
    if (path.includes("/commits?")) {
      return [{ sha: "b".repeat(40) }]
    }
    if (path.includes("/files?")) {
      return [{ patch: "Public change" }]
    }
    return []
  }
  const run = {
    id: 7,
    head_sha: "b".repeat(40),
    pull_requests: [],
    conclusion: "failure",
    path: ".github/workflows/pull-request.yml",
    html_url: "https://github.com/Mumma6/flowmark/actions/runs/7",
  }
  const history = await collectHistory(pull(1, "closed"), request, [run])
  assert.equal(history.checks.length, 1)
  assert.equal(history.evidence[0].url, run.html_url)
  const evidence = await failureEvidence(history, (path) =>
    path.includes("/jobs?")
      ? {
          jobs: [
            {
              name: "Typecheck",
              conclusion: "failure",
              check_run_url:
                "https://api.github.com/repos/Mumma6/flowmark/check-runs/9",
            },
            {
              name: "Untrusted",
              conclusion: "failure",
              check_run_url: "https://example.com/steal",
            },
          ],
        }
      : [
          {
            annotation_level: "failure",
            path: "packages/api/src/read.ts",
            start_line: 2,
            message: "Incorrect runtime boundary",
          },
        ],
  )
  assert.equal(evidence.length, 1)
  assert.match(evidence[0].text, /Incorrect runtime boundary/)
  assert.equal(evidence[0].url, run.html_url)
})

test("cold start samples eight recent merges; ongoing catch-up retains every new merge", () => {
  const merges = Array.from({ length: 20 }, (_, index) =>
    pull(index + 1, "closed"),
  )
  const first = captureMerges(
    initialState(),
    merges,
    "2026-11-01T00:00:00Z",
    now,
  )
  assert.equal(Object.keys(first.pendingMerges).length, 8)
  assert.ok(first.pendingMerges[20])
  const later = "2026-11-17T12:00:00.000Z"
  const additions = Array.from({ length: 15 }, (_, index) => ({
    ...pull(index + 21, "closed"),
    merged_at: later,
  }))
  const next = captureMerges(first, additions, first.lastPollAt, later)
  assert.equal(Object.keys(next.pendingMerges).length, 23)
})

test("PR discussion includes human replies and prior findings as bounded data for reassessment", async () => {
  const comments = await collectDiscussion(pull(1), (path) =>
    path.includes("issues/")
      ? [
          {
            body: "This is an intentional boundary; see the existing ADR.",
            html_url: "human",
            user: { login: "reviewer" },
            updated_at: now,
          },
        ]
      : [],
  )
  assert.equal(comments.length, 1)
  assert.equal(comments[0].author, "reviewer")
  assert.match(comments[0].text, /intentional boundary/)
})
