import { execFileSync } from "node:child_process"
import { paginate } from "./collect.mjs"
import { markdown } from "./local-state.mjs"

export const repository = "Mumma6/flowmark"
export const github = (path, { method = "GET", body } = {}) => {
  const args = [
    "api",
    "--hostname",
    "github.com",
    "-H",
    "X-GitHub-Api-Version: 2022-11-28",
    "--method",
    method,
    path,
  ]
  if (body) {
    args.push("--input", "-")
  }
  try {
    const output = execFileSync("gh", args, {
      encoding: "utf8",
      input: body ? JSON.stringify(body) : undefined,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 60_000,
      stdio: ["pipe", "pipe", "pipe"],
    })
    return output.trim() ? JSON.parse(output) : null
  } catch {
    throw new Error(
      `GitHub ${method} failed for ${path.split("?")[0]}; check local gh authentication/access. Provider diagnostics were withheld.`,
    )
  }
}
export const apiPath = (suffix) =>
  `repos/${repository}${suffix ? `/${suffix}` : ""}`
export const collection = (path, request = github, limit = 5, stop) =>
  paginate({
    request,
    path,
    limit,
    stop,
    onLimit: () => {
      throw new Error(
        `Incomplete GitHub pagination for ${path.split("?")[0]}; narrow the collection before continuing`,
      )
    },
  })
export const safeSourcePath = (path) =>
  typeof path === "string" &&
  !path.startsWith("/") &&
  !path.split("/").some((part) => ["..", ".", ""].includes(part)) &&
  !path.includes("\\") &&
  !/[\x00-\x1f]/.test(path) &&
  !path.startsWith("private/")
export const readSource = (sha, path, request = github) => {
  if (!/^[a-f0-9]{40}$/.test(sha) || !safeSourcePath(path)) {
    throw new Error(
      "Expected exact public commit SHA and repository-relative source path",
    )
  }
  const value = request(
    apiPath(
      `contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${sha}`,
    ),
  )
  if (
    value.type !== "file" ||
    value.encoding !== "base64" ||
    value.size > 256000
  ) {
    throw new Error(
      "Source is not a bounded text file; record partial coverage instead",
    )
  }
  const bytes = Buffer.from(value.content, "base64")
  if (bytes.includes(0)) {
    throw new Error("Binary source is not reviewable text")
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
}
export const treePaths = (sha, request = github) => {
  const value = request(apiPath(`git/trees/${sha}?recursive=1`))
  if (value.truncated || !Array.isArray(value.tree)) {
    throw new Error("Incomplete public source tree")
  }
  return value.tree
    .filter((entry) => entry.type === "blob" && safeSourcePath(entry.path))
    .map((entry) => entry.path)
}
export const isRuleFile = (path) =>
  path === "AGENTS.md" ||
  [
    ".node-version",
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "rust-toolchain.toml",
  ].includes(path) ||
  /(^|\/)AGENTS.md$/.test(path) ||
  /^\.agents\/skills\/[^/]+\/SKILL.md$/.test(path) ||
  /^docs\/.*\.md$/.test(path) ||
  /^(scripts\/.*\.mjs|eslint.config.mjs|Cargo.toml|\.cursor\/rules\/.*\.mdc)$/.test(
    path,
  ) ||
  /(^|\/)README.md$/.test(path)
export const collectDiscussion = async (pull, request = github) => {
  const paths = [
    `pulls/${pull.number}/comments`,
    `pulls/${pull.number}/reviews`,
    `issues/${pull.number}/comments`,
  ]
  const items = await paths.reduce(
    async (pending, path) => [
      ...(await pending),
      ...(await collection(apiPath(path), request, 2)),
    ],
    Promise.resolve([]),
  )
  return items
    .filter((item) => item.body)
    .sort((a, b) =>
      (b.updated_at ?? b.submitted_at ?? "").localeCompare(
        a.updated_at ?? a.submitted_at ?? "",
      ),
    )
    .reduce((result, item) => {
      const remaining =
        12000 -
        result.reduce((total, current) => total + current.text.length, 0)
      return remaining > 0
        ? [
            ...result,
            {
              url: item.html_url,
              author: item.user?.login,
              text: item.body.slice(0, Math.min(4000, remaining)),
            },
          ]
        : result
    }, [])
}
export const collectHistory = async (pull, request = github, runs = []) => {
  const files = await collection(
    apiPath(`pulls/${pull.number}/files`),
    request,
    3,
  )
  const discussion = await collectDiscussion(pull, request)
  const commits = runs.length
    ? await collection(apiPath(`pulls/${pull.number}/commits`), request, 2)
    : []
  const identities = new Set([
    pull.head.sha,
    ...commits.map((commit) => commit.sha),
  ])
  const checks = runs
    .filter(
      (run) =>
        (run.pull_requests ?? []).some((item) => item.number === pull.number) ||
        identities.has(run.head_sha),
    )
    .map(({ id, conclusion, path, html_url }) => ({
      id,
      conclusion,
      path,
      url: html_url,
    }))
  const evidence = [
    ...discussion.filter(
      (item) => !item.text.startsWith("<!-- flowmark-factory-local -->"),
    ),
    ...checks
      .filter((run) =>
        ["failure", "timed_out", "action_required"].includes(run.conclusion),
      )
      .map((run) => ({
        url: run.url,
        text: `Workflow ${run.path}: ${run.conclusion}. Common cause is unverified; inspect annotations before proposing a lesson.`,
      })),
    ...files
      .filter((file) => file.patch)
      .map((file) => ({ url: pull.html_url, text: file.patch.slice(0, 6000) })),
  ]
  const bounded = evidence.reduce((result, item) => {
    const remaining =
      12000 - result.reduce((total, current) => total + current.text.length, 0)
    return remaining > 0
      ? [...result, { ...item, text: item.text.slice(0, remaining) }]
      : result
  }, [])
  return {
    number: pull.number,
    incomplete:
      evidence.reduce((sum, item) => sum + item.text.length, 0) > 12000,
    sha: pull.merge_commit_sha ?? pull.head.sha,
    url: pull.html_url,
    title: pull.title.slice(0, 200),
    evidence: bounded,
    checks,
  }
}
export const reviewComment = (job, result) => {
  const marker = "<!-- flowmark-factory-local -->"
  const header = `${marker}\nLocal engineering review · revision ${job.sha.slice(0, 12)} · ${result.coverage} coverage\n\n`
  return (
    header +
    (result.findings.length
      ? result.findings
          .map(
            (finding) =>
              `**${markdown(finding.id)}** — [${markdown(finding.file)}:${finding.line}](https://github.com/${repository}/blob/${job.sha}/${finding.file.split("/").map(encodeURIComponent).join("/")}#L${finding.line})\n\n${markdown(finding.impact).replaceAll("@", "＠")}\n\nSuggested change: ${markdown(finding.suggestion).replaceAll("@", "＠")}\n\nRule: ${finding.ruleFile} · [factory:${finding.id}]`,
          )
          .join("\n\n---\n\n")
      : "Previously reported findings have been reviewed at this revision; no actionable findings remain in the inspected scope.")
  )
}
export const publishReview = async (job, result, request = github) => {
  if (job.kind !== "review") {
    throw new Error("Only current PR review findings can be published")
  }
  const current = request(apiPath(`pulls/${job.number}`))
  if (
    current.state !== "open" ||
    current.head.sha !== job.sha ||
    current.base.ref !== "staging"
  ) {
    return {
      status: "stale",
      message:
        "PR closed or changed; report retained locally without publishing",
    }
  }
  const comments = await collection(
    apiPath(`issues/${job.number}/comments`),
    request,
  )
  const own = comments.filter((comment) =>
    comment.body.startsWith("<!-- flowmark-factory-local -->"),
  )
  const user = own.length ? request("user").login : null
  const existing = own.find((comment) => comment.user.login === user)
  if (existing && result.coverage !== "complete") {
    return {
      status: "partial-local-only",
      message:
        "Existing findings preserved until complete review; new findings remain in the local report",
    }
  }
  const body = reviewComment(job, result)
  if (existing?.body === body || (!existing && result.findings.length === 0)) {
    return { status: "quiet" }
  }
  // Recheck immediately before the write; the public body also binds every finding to its SHA.
  if (request(apiPath(`pulls/${job.number}`)).head.sha !== job.sha) {
    return { status: "stale" }
  }
  request(
    existing
      ? apiPath(`issues/comments/${existing.id}`)
      : apiPath(`issues/${job.number}/comments`),
    { method: existing ? "PATCH" : "POST", body: { body } },
  )
  return { status: "published" }
}

export const failureEvidence = async (history, request = github) => {
  if (!Array.isArray(history.checks)) {
    throw new Error("Check history was not collected; prepare this job again")
  }
  const failed = history.checks
    .filter((run) =>
      ["failure", "timed_out", "action_required"].includes(run.conclusion),
    )
    .slice(0, 2)
  return failed.reduce(async (pending, run) => {
    const previous = await pending
    const jobs = await collection(
      apiPath(`actions/runs/${run.id}/jobs`),
      (path) => request(path).jobs,
      2,
    )
    const annotations = await jobs
      .filter((job) => job.conclusion === "failure")
      .slice(0, 2)
      .reduce(async (items, job) => {
        const collected = await items
        const match = job.check_run_url?.match(
          /^https:\/\/api\.github\.com\/repos\/Mumma6\/flowmark\/check-runs\/(\d+)$/,
        )
        if (!match) {
          return collected
        }
        const values = await collection(
          apiPath(`check-runs/${match[1]}/annotations`),
          request,
          2,
        )
        return [
          ...collected,
          ...values
            .filter((value) => value.annotation_level === "failure")
            .slice(0, 3)
            .map((value) => ({
              url: run.url,
              text: `${job.name}: ${value.path}:${value.start_line}: ${value.message.slice(0, 1000)}`,
            })),
        ]
      }, Promise.resolve([]))
    return [...previous, ...annotations]
  }, Promise.resolve([]))
}
