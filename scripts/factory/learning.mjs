const failed = new Set(["failure", "timed_out", "action_required"])
export const summarize = ({
  pulls,
  runs,
  reviews,
  decisions = [],
  now = new Date().toISOString(),
}) => {
  const merged = new Map(pulls.map((pull) => [pull.number, pull]))
  const groups = new Map()
  const add = (id, number, url) => {
    const group = groups.get(id) ?? new Map()
    group.set(number, [...new Set([...(group.get(number) ?? []), url])])
    groups.set(id, group)
  }
  runs
    .filter((run) => failed.has(run.conclusion))
    .forEach((run) => {
      const associated = (run.pull_requests ?? []).map((pull) => pull.number)
      const numbers = associated.length
        ? associated
        : pulls
            .filter(
              (pull) =>
                pull.head.sha === run.head_sha ||
                pull.commitShas?.includes(run.head_sha),
            )
            .map((pull) => pull.number)
      numbers
        .filter((number) => merged.has(number))
        .forEach((number) =>
          add(`ci:${run.path ?? run.name}`, number, run.html_url),
        )
    })
  reviews.forEach(({ number, body, html_url }) => {
    if (merged.has(number)) {
      // Reviewers supply stable identifiers; prose similarity is not evidence of recurrence.
      ;[...body.matchAll(/\[factory:([a-z][a-z0-9-]{1,63})\]/g)].forEach(
        (match) => add(`review:${match[1]}`, number, html_url),
      )
    }
  })
  const suppressed = new Set(
    decisions
      .filter((decision) => decision.until >= now.slice(0, 10))
      .map((decision) => decision.id),
  )
  const recurring = [...groups]
    .filter(([id, evidence]) => evidence.size >= 3 && !suppressed.has(id))
    .map(([id, evidence]) => ({
      id,
      pullRequests: [...evidence].map(([number, urls]) => ({
        number,
        url: merged.get(number).html_url,
        evidence: urls,
      })),
      proposal: id.startsWith("ci:")
        ? "Inspect the linked failures to distinguish test flakiness, tooling and implementation defects. Propose a focused fix or instruction change only after confirming a common cause."
        : "Review the linked findings against the existing rule. Propose one focused clarification or regression check if the same cause is confirmed; do not rewrite instructions automatically.",
    }))
    .sort(
      (a, b) =>
        b.pullRequests.length - a.pullRequests.length ||
        a.id.localeCompare(b.id),
    )
  return {
    recurring,
    suppressed: [...suppressed],
    mergedPullRequests: pulls.length,
  }
}

const escapeMarkdown = (text) =>
  text.replace(/[\[\]<>`*_\\]/g, "\\$&").replace(/[\r\n]/g, " ")
export const renderLearning = (report) =>
  [
    "## Engineering learning evidence",
    `Window: ${report.since} to ${report.generatedAt}. ${report.mergedPullRequests} merged PR(s) sampled.`,
    report.incomplete.length
      ? `**Partial evidence:** ${report.incomplete.map(escapeMarkdown).join("; ")}. Absence of findings is not a clean bill of health.`
      : "Collection completed within the configured window and limits.",
    "",
    ...report.recurring.flatMap((finding) => [
      `### ${escapeMarkdown(finding.id)} (${finding.pullRequests.length} distinct PRs)`,
      finding.proposal,
      ...finding.pullRequests.map(
        (pull) =>
          `- [PR #${pull.number}](${pull.url}): ${pull.evidence.map((url, index) => `[evidence ${index + 1}](${url})`).join(", ")}`,
      ),
      "",
    ]),
    report.recurring.length
      ? ""
      : "No new recurrence crossed the three-PR threshold in this sample.",
    "Failures and reviewer identifiers are signals, not verified common causes. Hosted AI is off: semantic lessons and instruction proposals have not been generated. No instructions or tasks were changed. Full bounded review evidence is in the JSON artifact; approved work belongs in private/.",
  ].join("\n") + "\n"

export const validateDecisions = (value) => {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item.id !== "string" ||
        !/^(ci|review):\S+$/.test(item.id) ||
        typeof item.reason !== "string" ||
        !item.reason.trim() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(item.until) ||
        !Number.isFinite(Date.parse(item.until)) ||
        !["accepted", "deferred", "rejected"].includes(item.status),
    )
  ) {
    throw new Error(
      "Learning decisions require id, reason, ISO until date and accepted/deferred/rejected status",
    )
  }
  return value
}
