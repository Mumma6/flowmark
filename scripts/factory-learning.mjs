import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import {
  renderLearning,
  summarize,
  validateDecisions,
} from "./factory/learning.mjs"
import { paginate } from "./factory/collect.mjs"

const repository = process.env.GITHUB_REPOSITORY
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "")) {
  throw new Error("GITHUB_REPOSITORY must identify the source repository")
}
if (!process.env.GH_TOKEN) {
  throw new Error(
    "GH_TOKEN with contents/actions/pull-requests read access is required",
  )
}
const now = new Date()
const since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
const incomplete = []
const api = async (path) => {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/${path}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!response.ok) {
    // Never print response bodies, credentials or arbitrary provider diagnostics.
    throw new Error(
      `GitHub evidence request failed (${response.status}) for ${path.split("?")[0]}`,
    )
  }
  return response.json()
}
const pages = (path, select, stop, limit = 10) =>
  paginate({
    request: api,
    path,
    select,
    stop,
    limit,
    onLimit: (path) =>
      incomplete.push(`Pagination limit reached for ${path.split("?")[0]}`),
  })
const closed = await pages(
  "pulls?state=closed&sort=updated&direction=desc",
  (value) => value,
  (items) => items.at(-1).updated_at < since,
)
const candidates = closed
  .filter((pull) => pull.merged_at >= since && pull.base.ref === "staging")
  .sort((a, b) => b.merged_at.localeCompare(a.merged_at))
const sampledPulls = candidates.slice(0, 50)
if (candidates.length > sampledPulls.length) {
  incomplete.push(
    `Sample limited to the latest ${sampledPulls.length} staging merges; ${candidates.length} found`,
  )
}
const runs = sampledPulls.length
  ? await pages(
      `actions/runs?event=pull_request&created=%3E%3D${since.slice(0, 10)}`,
      (value) => value.workflow_runs,
    )
  : []
// Historical runs often lose PR associations after branch deletion. Match exact
// PR commit SHAs as well as the final head, rather than guessing from branch names.
const pulls = await sampledPulls.reduce(async (pending, pull) => {
  const previous = await pending
  const commits = await pages(
    `pulls/${pull.number}/commits`,
    (value) => value,
    undefined,
    2,
  )
  return [
    ...previous,
    { ...pull, commitShas: commits.map((commit) => commit.sha) },
  ]
}, Promise.resolve([]))
// Sequential bounded requests avoid a burst against GitHub and preserve limits.
const reviews = await pulls.reduce(async (pending, pull) => {
  const previous = await pending
  const comments = await pages(
    `pulls/${pull.number}/comments`,
    (value) => value,
    undefined,
    2,
  )
  const submitted = await pages(
    `pulls/${pull.number}/reviews`,
    (value) => value,
    undefined,
    2,
  )
  return [
    ...previous,
    ...[...comments, ...submitted]
      .filter((item) => item.body)
      .map((item) => ({
        number: pull.number,
        body: item.body.slice(0, 4000),
        html_url: item.html_url,
      })),
  ]
}, Promise.resolve([]))
if (reviews.some((review) => review.body.length === 4000)) {
  incomplete.push("Review text limited to 4,000 characters per entry")
}
const decisions = validateDecisions(
  JSON.parse(
    readFileSync(
      new URL("../.github/factory/decisions.json", import.meta.url),
      "utf8",
    ),
  ),
)
const report = {
  version: 1,
  repository,
  sourceRevision: process.env.GITHUB_SHA ?? null,
  generatedAt: now.toISOString(),
  since,
  incomplete,
  ...summarize({ pulls, runs, reviews, decisions, now: now.toISOString() }),
  // Retain evidence, not a second task tracker. No PR body, source, secrets or local files.
  pulls: pulls.map((pull) => ({
    number: pull.number,
    url: pull.html_url,
    mergedAt: pull.merged_at,
    head: pull.head.sha,
    commitShas: pull.commitShas,
  })),
  reviews,
  runs: runs.map(
    ({ id, path, name, conclusion, html_url, head_sha, pull_requests }) => ({
      id,
      path,
      name,
      conclusion,
      html_url,
      head_sha,
      pull_requests: (pull_requests ?? []).map(({ number }) => ({ number })),
    }),
  ),
}
const directory = fileURLToPath(
  new URL("../.factory-reports/", import.meta.url),
)
mkdirSync(directory, { recursive: true })
writeFileSync(
  `${directory}learning.json`,
  JSON.stringify(report, null, 2) + "\n",
)
const markdown = renderLearning(report)
writeFileSync(`${directory}learning.md`, markdown)
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)
}
process.stdout.write(markdown)
