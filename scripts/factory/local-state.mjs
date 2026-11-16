import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"

export const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16)
export const initialState = () => ({
  version: 1,
  processed: {},
  lessons: {},
  pendingMerges: {},
  lastPollAt: null,
})
export const readJson = (path, fallback) =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback
export const writeJson = (path, value) => {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  })
  renameSync(temporary, path)
}
export const readState = (directory) => {
  const state = readJson(join(directory, "memory.json"), initialState())
  if (state.version !== 1 || !state.processed || !state.lessons) {
    throw new Error(
      "Unsupported factory memory; preserve it and investigate before continuing",
    )
  }
  return { ...initialState(), ...state }
}
export const captureMerges = (state, pulls, since, now) => {
  const candidates = pulls
    .filter(
      (pull) =>
        pull.merged_at >= since &&
        !state.processed[
          `retrospective:${pull.number}:${pull.merge_commit_sha}`
        ],
    )
    .sort(
      (a, b) => b.merged_at.localeCompare(a.merged_at) || b.number - a.number,
    )
  // Bootstrap a useful small sample, rather than scheduling the repository's
  // entire recent history. Later polls retain every newly discovered merge.
  const selected = state.lastPollAt ? candidates : candidates.slice(0, 8)
  return {
    ...state,
    pendingMerges: {
      ...state.pendingMerges,
      ...Object.fromEntries(
        selected.map((pull) => [
          pull.number,
          {
            number: pull.number,
            state: pull.state,
            draft: pull.draft,
            head: { sha: pull.head.sha },
            base: { sha: pull.base.sha, ref: pull.base.ref },
            merged_at: pull.merged_at,
            merge_commit_sha: pull.merge_commit_sha,
            html_url: pull.html_url,
            title: pull.title,
          },
        ]),
      ),
    },
    lastPollAt: now,
  }
}
export const withStateLock = async (directory, body) => {
  mkdirSync(directory, { recursive: true })
  const lock = join(directory, "record.lock")
  try {
    mkdirSync(lock)
  } catch {
    throw new Error(
      "Factory record lock exists; inspect its owning run before retrying",
    )
  }
  try {
    writeJson(join(lock, "owner.json"), {
      pid: process.pid,
      at: new Date().toISOString(),
    })
    return await body()
  } finally {
    rmSync(lock, { recursive: true })
  }
}
export const weekKey = (date) => {
  const monday = new Date(date)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}
export const planJobs = ({
  pulls,
  state,
  now,
  stagingSha,
  owners,
  mergeSince = new Date(new Date(now).getTime() - 14 * 86400000).toISOString(),
}) => {
  if (!owners.length) {
    throw new Error("At least one weekly owner is required")
  }
  const reviews = pulls
    .filter((pull) => pull.state === "open" && !pull.draft)
    .map((pull) => ({
      kind: "review",
      key: `review:${pull.number}:${pull.head.sha}`,
      number: pull.number,
      sha: pull.head.sha,
      baseSha: pull.base.sha,
    }))
  const merged = pulls
    .filter((pull) => pull.merged_at && pull.merged_at >= mergeSince)
    .sort((a, b) => b.merged_at.localeCompare(a.merged_at))
  const retros = merged.map((pull) => ({
    kind: "retrospective",
    key: `retrospective:${pull.number}:${pull.merge_commit_sha}`,
    number: pull.number,
    sha: pull.merge_commit_sha,
    baseSha: pull.base.sha,
  }))
  const week = weekKey(now)
  const owner =
    owners[
      Math.floor(new Date(week).getTime() / (7 * 86400000)) % owners.length
    ]
  const health = [
    { kind: "health", key: `health:${week}`, sha: stagingSha, owner },
  ]
  // Reserve room for learning/health even when many PR heads change together.
  const pending = (jobs) =>
    jobs.filter((job) => !Object.hasOwn(state.processed, job.key))
  return [
    ...pending(reviews).slice(0, 1),
    ...pending(retros).slice(0, 1),
    ...pending(health),
  ].slice(0, 3)
}

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}
const text = (value, maximum = 3000) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.length <= maximum
const publicText = (value, maximum = 3000) =>
  text(value, maximum) &&
  !/(?:private\/|\/Users\/|\/home\/|sk-[a-zA-Z0-9]{16}|postgres(?:ql)?:\/\/)/.test(
    value,
  )
const safeId = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(value)
const hasOnly = (value, keys) =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  Object.keys(value).every((key) => keys.includes(key))
export const validateResult = (result, job) => {
  assert(
    hasOnly(result, [
      "version",
      "jobKey",
      "coverage",
      "summary",
      "findings",
      "lessons",
    ]),
    "Unknown result fields",
  )
  assert(
    result.version === 1 && result.jobKey === job.key,
    "Result must match the prepared job",
  )
  assert(
    ["complete", "partial"].includes(result.coverage) &&
      publicText(result.summary),
    "Expected bounded summary and explicit coverage",
  )
  assert(
    Array.isArray(result.findings) && result.findings.length <= 5,
    "At most five actionable findings",
  )
  assert(
    Array.isArray(result.lessons) && result.lessons.length <= 3,
    "At most three learning observations",
  )
  assert(
    job.kind !== "retrospective" || result.findings.length === 0,
    "Retrospectives produce learning observations, not stale PR findings",
  )
  assert(
    job.kind === "retrospective" || result.lessons.length === 0,
    "Only retrospective jobs add cross-PR learning",
  )
  result.findings.forEach((finding) => {
    assert(
      hasOnly(finding, [
        "id",
        "category",
        "file",
        "line",
        "evidence",
        "ruleFile",
        "impact",
        "suggestion",
      ]),
      "Unknown finding fields",
    )
    assert(
      safeId(finding.id) &&
        ["architecture", "documentation", "correctness"].includes(
          finding.category,
        ),
      "Expected stable finding identity and category",
    )
    assert(
      job.inventory.includes(finding.file) &&
        Number.isSafeInteger(finding.line) &&
        finding.line > 0,
      "Finding requires a source path and positive line",
    )
    assert(
      job.ruleFiles.includes(finding.ruleFile),
      "Finding must cite an existing trusted rule/document",
    )
    assert(
      publicText(finding.evidence, 600) &&
        publicText(finding.impact, 1000) &&
        publicText(finding.suggestion, 1500),
      "Finding text must be bounded and public-safe",
    )
  })
  result.lessons.forEach((lesson) => {
    assert(
      hasOnly(lesson, [
        "id",
        "title",
        "observation",
        "target",
        "suggestedChange",
        "benefit",
        "verification",
        "evidence",
      ]),
      "Unknown lesson fields",
    )
    assert(
      safeId(lesson.id) &&
        publicText(lesson.title, 140) &&
        publicText(lesson.observation),
      "Expected stable lesson and source-grounded observation",
    )
    assert(
      job.ruleFiles.includes(lesson.target),
      "Improve an existing instruction/check/document, not an invented rule",
    )
    assert(
      publicText(lesson.suggestedChange) &&
        publicText(lesson.benefit, 1000) &&
        publicText(lesson.verification, 1000),
      "Lesson needs a concrete proposal, benefit and verification",
    )
    assert(
      Array.isArray(lesson.evidence) &&
        lesson.evidence.length > 0 &&
        lesson.evidence.length <= 10,
      "Learning requires bounded PR evidence",
    )
    assert(
      lesson.evidence.some((evidence) => evidence.number === job.number),
      "A retrospective observation must include the current merged PR",
    )
    lesson.evidence.forEach((evidence) => {
      assert(
        hasOnly(evidence, ["number", "url", "quote"]),
        "Unknown evidence fields",
      )
      const source = job.history.find((pull) => pull.number === evidence.number)
      assert(
        source &&
          publicText(evidence.quote, 600) &&
          source.evidence.some(
            (item) =>
              item.url === evidence.url && item.text.includes(evidence.quote),
          ),
        "Learning evidence must quote collected public evidence exactly",
      )
    })
  })
  assert(
    new Set(result.findings.map((finding) => finding.id)).size ===
      result.findings.length,
    "Duplicate finding identities",
  )
  assert(
    new Set(result.lessons.map((lesson) => lesson.id)).size ===
      result.lessons.length,
    "Duplicate lesson identities",
  )
  return result
}
export const validateSource = (finding, source) => {
  const lines = source.split("\n")
  assert(
    finding.line <= lines.length &&
      lines
        .slice(Math.max(0, finding.line - 2), finding.line + 4)
        .join("\n")
        .includes(finding.evidence),
    "Finding evidence must occur at the cited public source location",
  )
}
export const applyResult = (state, job, result, decisions, now) => {
  if (state.processed[job.key]) {
    return { state, proposals: [], duplicate: true }
  }
  const lessons = { ...state.lessons }
  const proposals = result.lessons.flatMap((lesson) => {
    const previous = lessons[lesson.id]
    const evidence = [
      ...new Map(
        [...(previous?.evidence ?? []), ...lesson.evidence].map((item) => [
          `${item.number}:${item.url}:${item.quote}`,
          item,
        ]),
      ).values(),
    ]
    const prs = [...new Set(evidence.map((item) => item.number))]
    lessons[lesson.id] = {
      ...lesson,
      evidence,
      firstSeen: previous?.firstSeen ?? now,
      lastSeen: now,
    }
    const suppressed = decisions.some(
      (decision) =>
        decision.id === lesson.id && decision.until >= now.slice(0, 10),
    )
    return prs.length >= 3 && !suppressed && !previous?.proposedAt
      ? [{ ...lessons[lesson.id], prs }]
      : []
  })
  proposals.forEach((proposal) => {
    lessons[proposal.id].proposedAt = now
  })
  return {
    state: {
      ...state,
      lessons,
      pendingMerges: Object.fromEntries(
        Object.entries(state.pendingMerges ?? {}).filter(
          ([number]) =>
            job.kind !== "retrospective" || Number(number) !== job.number,
        ),
      ),
      processed: {
        ...state.processed,
        [job.key]: {
          at: now,
          coverage: result.coverage,
          report: `${hash(job.key)}.md`,
        },
      },
    },
    proposals,
    duplicate: false,
  }
}
export const validateDecisions = (value) => {
  assert(
    Array.isArray(value) &&
      value.every(
        (decision) =>
          hasOnly(decision, ["id", "status", "reason", "until"]) &&
          safeId(decision.id) &&
          ["accepted", "rejected", "deferred"].includes(decision.status) &&
          text(decision.reason) &&
          /^\d{4}-\d{2}-\d{2}$/.test(decision.until) &&
          Number.isFinite(Date.parse(decision.until)),
      ),
    "Decisions require stable id, accepted/rejected/deferred status, reason and review date",
  )
  return value
}
export const markdown = (value) =>
  String(value).replace(/[\\`*_[\]<>#]/g, "\\$&")
export const renderResult = (job, result) =>
  `# ${job.kind} — ${job.number ? `PR #${job.number}` : job.owner}\n\nRevision: ${job.sha}\nCoverage: ${result.coverage}\n\n${markdown(result.summary)}\n\n${result.findings.map((finding) => `## ${markdown(finding.id)}\n\n${markdown(finding.file)}:${finding.line}\n\nEvidence: ${markdown(finding.evidence)}\n\nRule: ${finding.ruleFile}\n\n${markdown(finding.impact)}\n\nSuggested change: ${markdown(finding.suggestion)}`).join("\n\n")}\n`
export const renderObservations = (result) =>
  result.lessons
    .map(
      (lesson) =>
        `## Observation — ${markdown(lesson.title)}\n\n${markdown(lesson.observation)}\n\nTarget: ${lesson.target}\n\nSuggested improvement (pending recurrence/human approval): ${markdown(lesson.suggestedChange)}\n\n${lesson.evidence.map((item) => `- PR #${item.number}: ${item.url} — ${markdown(item.quote)}`).join("\n")}`,
    )
    .join("\n\n")
export const renderProposal = (proposal) =>
  `# Proposal — ${markdown(proposal.title)}\n\nPending human approval. This file is a proposal, not an accepted task or coding rule.\n\n${markdown(proposal.observation)}\n\n## Evidence\n\n${proposal.evidence.map((item) => `- PR #${item.number}: ${item.url}\n  ${markdown(item.quote)}`).join("\n")}\n\n## Proposed improvement\n\nTarget: ${proposal.target}\n\n${markdown(proposal.suggestedChange)}\n\nBenefit: ${markdown(proposal.benefit)}\n\nVerification: ${markdown(proposal.verification)}\n\nAfter approval, use the existing feature-roadmap workflow to create or update the owning task. Record accepted/deferred/rejected decisions in decisions.json.\n`
