import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  apiPath,
  collectHistory,
  collectDiscussion,
  collection,
  github,
  failureEvidence,
  isRuleFile,
  publishReview,
  readSource,
  treePaths,
} from "./factory/local-github.mjs"
import {
  applyResult,
  captureMerges,
  withStateLock,
  hash,
  planJobs,
  readJson,
  readState,
  renderProposal,
  renderResult,
  renderObservations,
  validateDecisions,
  validateResult,
  validateSource,
  writeJson,
} from "./factory/local-state.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const directory = join(root, "private/plans/software-factory/local")
const now = new Date().toISOString()
const owners = [
  "packages/api",
  "packages/sdk",
  "packages/db",
  "crates/flowmark-engine",
  "apps/server",
  "apps/dashboard",
  "apps/docs",
  "apps/web",
  "packages/core",
  "packages/auth",
  "packages/engine",
  "scripts",
  "docs",
  ".agents/skills",
  ".github",
]
const command = process.argv[2] ?? "status"
let state = readState(directory)
const jobPath = (id) => {
  if (!/^[a-f0-9]{16}$/.test(id ?? "")) {
    throw new Error("Expected the prepared job ID")
  }
  return join(directory, "queue", `${id}.json`)
}
const readJob = (id) => {
  const job = readJson(jobPath(id), null)
  if (!job || hash(job.key) !== id || job.repository !== "Mumma6/flowmark") {
    throw new Error("Unknown local factory job")
  }
  return job
}
const readDecisions = () =>
  validateDecisions(readJson(join(directory, "decisions.json"), []))

if (command === "prepare") {
  // Only reads committed public source through GitHub; never checks out or executes PR code.
  const metadata = github(apiPath(""))
  if (metadata.full_name !== "Mumma6/flowmark") {
    throw new Error("Repository identity mismatch")
  }
  const open = await collection(apiPath("pulls?state=open&base=staging"))
  const since =
    state.lastPollAt ??
    new Date(new Date(now).getTime() - 14 * 86400000).toISOString()
  const closed = await collection(
    apiPath("pulls?state=closed&base=staging&sort=updated&direction=desc"),
    github,
    5,
    (items) => items.at(-1).updated_at < since,
  )
  const stagingSha = github(apiPath("branches/staging")).commit.sha
  // Persist discovered merges before expensive review preparation. Re-read under
  // the same lock as completion so concurrent polling never loses observations.
  state = await withStateLock(directory, () => {
    const next = captureMerges(readState(directory), closed, since, now)
    writeJson(join(directory, "memory.json"), next)
    return next
  })
  const pulls = [...open, ...Object.values(state.pendingMerges)]
  const planned = planJobs({
    pulls,
    state,
    now,
    stagingSha,
    owners,
    mergeSince: "1970-01-01T00:00:00.000Z",
  })
  const decisions = readDecisions()
  if (!planned.length) {
    process.stdout.write(
      '{"jobs":[],"message":"No new PR head, merge or weekly scope"}\n',
    )
  }
  const jobs = await planned.reduce(async (pending, candidate) => {
    const previous = await pending
    const paths = treePaths(candidate.sha)
    const ruleFiles = (
      candidate.kind === "review" ? treePaths(candidate.baseSha) : paths
    ).filter(isRuleFile)
    const pull = pulls.find((item) => item.number === candidate.number)
    const files = pull
      ? await collection(apiPath(`pulls/${pull.number}/files`))
      : []
    let patchBudget = 60000
    const patches = files.map((file) => {
      const patch = file.patch
        ? file.patch.slice(0, Math.min(6000, patchBudget))
        : null
      patchBudget -= patch?.length ?? 0
      return {
        file: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch,
      }
    })
    const recent = closed
      .filter((item) => item.merged_at)
      .sort((a, b) => b.merged_at.localeCompare(a.merged_at))
      .slice(0, 8)
    const runs =
      candidate.kind === "retrospective"
        ? await collection(
            apiPath(
              `actions/runs?event=pull_request&created=%3E%3D${new Date(new Date(now).getTime() - 14 * 86400000).toISOString().slice(0, 10)}`,
            ),
            (path) => github(path).workflow_runs,
          )
        : []
    const history =
      candidate.kind === "retrospective"
        ? await [pull, ...recent.filter((item) => item.number !== pull.number)]
            .slice(0, 8)
            .reduce(
              async (items, item) => [
                ...(await items),
                await collectHistory(item, github, runs),
              ],
              Promise.resolve([]),
            )
        : []
    const inventory = [
      ...new Set([
        ...ruleFiles,
        ...paths.filter(
          (path) =>
            ruleFiles.includes(path) ||
            (candidate.kind === "health"
              ? path.startsWith(`${candidate.owner}/`)
              : files.some((file) => file.filename === path) ||
                /(^|\/)README.md$/.test(path) ||
                /^(docs\/|apps\/docs\/content\/)/.test(path)),
        ),
      ]),
    ]
    const job = {
      ...candidate,
      repository: "Mumma6/flowmark",
      preparedAt: now,
      // Repository instructions are trusted only at the reviewed base. Changed instructions are data.
      currentSha: stagingSha,
      trustedSha: candidate.kind === "review" ? candidate.baseSha : stagingSha,
      inventory,
      ruleFiles,
      changes: patches,
      discussion:
        candidate.kind === "review" ? await collectDiscussion(pull) : [],
      history,
      limits: { findings: 5, lessons: 3, sourceBytes: 256000, weeklyFiles: 12 },
      incomplete:
        files.some((file) => !file.patch || file.patch.length > 6000) ||
        patchBudget === 0
          ? [
              "Some patches are missing or truncated; fetch relevant source or report partial coverage",
            ]
          : [],
      knownLessonIds: Object.keys(state.lessons),
      previousLessons: Object.values(state.lessons)
        .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
        .slice(0, 32)
        .map(({ id, title, observation, evidence, proposedAt }) => ({
          id,
          title,
          observation,
          prs: [...new Set(evidence.map((item) => item.number))],
          proposedAt,
        })),
      decisions,
    }
    writeJson(jobPath(hash(job.key)), job)
    return [
      ...previous,
      {
        id: hash(job.key),
        kind: job.kind,
        number: job.number,
        owner: job.owner,
        file: jobPath(hash(job.key)),
      },
    ]
  }, Promise.resolve([]))
  if (jobs.length) {
    process.stdout.write(
      JSON.stringify(
        {
          jobs,
          resultSchema: join(root, "scripts/factory/result-schema.json"),
        },
        null,
        2,
      ) + "\n",
    )
  }
} else if (command === "source") {
  const job = readJob(process.argv[3])
  const path = process.argv[4]
  const trusted = process.argv.includes("--trusted")
  if (
    !job.inventory.includes(path) ||
    (trusted && !job.ruleFiles.includes(path))
  ) {
    throw new Error(
      "Source must be in the prepared public inventory; trusted reads are limited to rule files",
    )
  }
  const start = Number(
    process.argv.slice(5).find((value) => !value.startsWith("--")) ?? 1,
  )
  if (!Number.isSafeInteger(start) || start < 1) {
    throw new Error("Expected positive starting line")
  }
  const source = readSource(
    trusted
      ? job.trustedSha
      : process.argv.includes("--current")
        ? job.currentSha
        : job.sha,
    path,
  )
  process.stdout.write(
    source
      .split("\n")
      .slice(start - 1, start + 119)
      .map((line, index) => `${start + index}: ${line}`)
      .join("\n") + "\n",
  )
} else if (command === "checks") {
  const id = process.argv[3]
  const job = readJob(id)
  const number = Number(process.argv[4])
  const history = job.history.find((item) => item.number === number)
  if (job.kind !== "retrospective" || !history) {
    throw new Error("Checks must belong to a collected retrospective PR")
  }
  const evidence = await failureEvidence(history)
  history.evidence = [
    ...new Map(
      [...history.evidence, ...evidence].map((item) => [
        `${item.url}:${item.text}`,
        item,
      ]),
    ).values(),
  ]
  writeJson(jobPath(id), job)
  process.stdout.write(
    JSON.stringify(
      {
        number,
        evidence,
        note: "Bounded failure annotations; missing annotations do not prove a clean run",
      },
      null,
      2,
    ) + "\n",
  )
} else if (command === "complete") {
  const id = process.argv[3]
  const job = readJob(id)
  if (state.processed[job.key]) {
    process.stdout.write("Already recorded; no duplicate work.\n")
    process.exit(0)
  }
  const file = process.argv[4]
  const bytes = file ? readFileSync(file) : null
  if (!bytes || bytes.length > 64000) {
    throw new Error("Expected a result JSON file of at most 64 KB")
  }
  const result = validateResult(JSON.parse(bytes.toString("utf8")), job)
  const decisions = readDecisions()
  result.findings.forEach((finding) =>
    validateSource(finding, readSource(job.sha, finding.file)),
  )
  await withStateLock(directory, async () => {
    const current = readState(directory)
    if (current.processed[job.key]) {
      process.stdout.write(
        "Already recorded; no duplicate publishing or proposals.\n",
      )
    } else {
      const publication =
        process.argv.includes("--publish") && job.kind === "review"
          ? await publishReview(job, result)
          : { status: "local-only" }
      const applied = applyResult(current, job, result, decisions, now)
      mkdirSync(join(directory, "reports"), { recursive: true })
      writeFileSync(
        join(directory, "reports", `${id}.md`),
        renderResult(job, result) + renderObservations(result),
        { mode: 0o600 },
      )
      writeJson(join(directory, "reports", `${id}.json`), {
        jobKey: job.key,
        sha: job.sha,
        result,
        publication,
      })
      applied.proposals.forEach((proposal) => {
        mkdirSync(join(directory, "proposals"), { recursive: true })
        const path = join(directory, "proposals", `${proposal.id}.md`)
        // Human-edited proposals are never overwritten.
        if (!existsSync(path)) {
          writeFileSync(path, renderProposal(proposal), {
            flag: "wx",
            mode: 0o600,
          })
        }
      })
      writeJson(join(directory, "memory.json"), applied.state)
      if (!existsSync(join(directory, "decisions.json"))) {
        writeJson(join(directory, "decisions.json"), [])
      }
      process.stdout.write(
        JSON.stringify(
          {
            recorded: job.key,
            coverage: result.coverage,
            findings: result.findings.length,
            newProposals: applied.proposals.map((proposal) => proposal.id),
            publication,
          },
          null,
          2,
        ) + "\n",
      )
    }
  })
} else if (command === "lesson") {
  const id = process.argv[3]
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(id ?? "")) {
    throw new Error("Expected an existing stable cause ID")
  }
  process.stdout.write(
    JSON.stringify(
      {
        lesson: state.lessons[id] ?? null,
        decisions: readDecisions().filter((decision) => decision.id === id),
      },
      null,
      2,
    ) + "\n",
  )
} else if (command === "status") {
  process.stdout.write(
    JSON.stringify(
      {
        processed: Object.keys(state.processed).length,
        lessons: Object.keys(state.lessons).length,
        proposed: Object.values(state.lessons).filter(
          (lesson) => lesson.proposedAt,
        ).length,
        directory,
      },
      null,
      2,
    ) + "\n",
  )
} else {
  throw new Error(
    "Use factory:local prepare | source <id> <path> [line] [--trusted|--current] | checks <id> <pr-number> | lesson <cause-id> | complete <id> <result.json> [--publish] | status",
  )
}
