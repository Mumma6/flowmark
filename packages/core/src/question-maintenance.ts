import { Match, Schema } from "effect"

const Identifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
)
const Path = Schema.String.check(
  Schema.isMaxLength(180),
  Schema.isPattern(/^(?!\/)(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\\:\p{Cc}]+$/u),
)
const revision = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 1_000_000 }),
)

const SiteSchema = Schema.Struct({
  behaviorRevision: Identifier,
  probeId: Identifier,
  path: Path,
})

export const QuestionMaintenanceInputSchema = Schema.Struct({
  installationId: Identifier,
  repository: Identifier,
  behaviorId: Identifier,
  questionId: Identifier,
  questionRevision: revision,
  previous: SiteSchema,
  current: Schema.Struct({
    ...SiteSchema.fields,
    change: Schema.Literals(["moved", "split", "link-broken", "unchanged"]),
  }),
  exclusion: Schema.Literals(["none", "deliberate", "retired"]),
  access: Schema.Literals(["authorized", "revoked", "insufficient"]),
  triggers: Schema.Array(
    Schema.Struct({
      kind: Schema.Literals(["source", "deployment", "traffic"]),
      key: Identifier,
    }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(8)),
  pullRequest: Schema.Struct({
    state: Schema.Literals([
      "none",
      "open-feature",
      "open-repair",
      "closed",
      "superseded",
      "competing",
    ]),
    branch: Schema.NullOr(Identifier),
  }),
  fixtureReadback: Schema.Literals(["verified", "failed", "missing"]),
  live: Schema.Struct({
    deployment: Schema.Literals(["repaired", "other", "none"]),
    eligibleObservations: Schema.Int.check(
      Schema.isBetween({ minimum: 0, maximum: 100_000 }),
    ),
    mature: Schema.Boolean,
  }),
  support: Schema.Literals(["current", "expired"]),
})
export type QuestionMaintenanceInput =
  typeof QuestionMaintenanceInputSchema.Type

const repairBranch = (questionId: string, questionRevision: number) =>
  `flowmark/repair-${questionId.replaceAll("/", "-")}-r${questionRevision}`

const meaning = (
  questionRevision: number,
  behaviorRevision: string,
  label: "prior" | "current",
) => ({ questionRevision, behaviorRevision, label })

/**
 * Re-evaluate one question after source, deployment and traffic triggers.
 * Access and evidence status are inputs. The decision never merges or rolls out.
 */
export const maintainQuestion = (input: QuestionMaintenanceInput) => {
  const identity = {
    installationId: input.installationId,
    behaviorId: input.behaviorId,
    questionId: input.questionId,
    questionRevision: input.questionRevision,
  }
  const prior = meaning(
    input.questionRevision,
    input.previous.behaviorRevision,
    "prior",
  )
  const preserved = meaning(
    input.questionRevision,
    input.previous.behaviorRevision,
    "current",
  )
  const successor = meaning(
    input.questionRevision + 1,
    input.current.behaviorRevision,
    "current",
  )
  const blocked =
    input.exclusion !== "none" ||
    input.access !== "authorized" ||
    input.support === "expired"
  const readiness =
    !blocked && input.fixtureReadback === "verified" ? "restored" : "unrestored"
  const answerability =
    readiness === "restored" &&
    input.live.deployment === "repaired" &&
    input.live.mature &&
    input.live.eligibleObservations > 0
      ? "restored"
      : "unrestored"
  const retrieval = Match.value(input.access).pipe(
    Match.when("revoked", () => ({
      status: "denied" as const,
      transcript: null,
      caseLabel: null,
    })),
    Match.orElse(() =>
      answerability === "restored" && input.support === "current"
        ? {
            status: "available" as const,
            transcript: null,
            caseLabel: input.current.behaviorRevision,
          }
        : {
            status: "unavailable" as const,
            transcript: null,
            caseLabel: null,
          },
    ),
  )
  const base = {
    identity,
    triggerCount: input.triggers.length,
    coalesced: true,
    readiness,
    answerability,
    retrieval,
    opensInstrumentation: false,
  }
  if (input.exclusion !== "none") {
    return {
      ...base,
      decision: "exception" as const,
      meanings: { previous: prior, current: preserved },
      repair: null,
      explanation:
        "The question was retired or excluded by review. Its original meaning stays intact and no instrumentation is opened.",
    }
  }
  if (input.access === "revoked") {
    return {
      ...base,
      decision: "unavailable" as const,
      meanings: { previous: prior, current: preserved },
      repair: null,
      explanation:
        "The grant is revoked. The fresh session receives no case and no instrumentation is opened.",
    }
  }
  if (input.access === "insufficient") {
    return {
      ...base,
      decision: "operator" as const,
      meanings: { previous: prior, current: preserved },
      repair: null,
      explanation:
        "Authority is insufficient. An operator must act. No instrumentation pull request is opened.",
    }
  }
  if (input.support === "expired") {
    return {
      ...base,
      decision: "unavailable" as const,
      meanings: { previous: prior, current: preserved },
      repair: null,
      explanation:
        "Support for this case has expired. It stays unavailable and no instrumentation pull request is opened.",
    }
  }
  if (
    input.current.change === "unchanged" &&
    (input.live.eligibleObservations === 0 || !input.live.mature)
  ) {
    return {
      ...base,
      decision: "wait" as const,
      meanings: { previous: prior, current: preserved },
      repair: null,
      explanation:
        "Eligible traffic has not matured. Waiting does not open an instrumentation pull request.",
    }
  }
  if (input.current.change === "moved") {
    return {
      ...base,
      decision: "preserve" as const,
      meanings: { previous: preserved, current: preserved },
      repair: null,
      explanation: `Probe ${input.current.probeId} moved from ${input.previous.path} to ${input.current.path}. The behavior revision ${input.previous.behaviorRevision} is unchanged.`,
    }
  }
  if (input.current.change === "split") {
    return {
      ...base,
      decision: "successor" as const,
      meanings: { previous: prior, current: successor },
      repair: null,
      explanation: `The behavior split from ${input.previous.behaviorRevision} to ${input.current.behaviorRevision}. Earlier cases keep the prior meaning.`,
    }
  }
  if (input.current.change !== "link-broken") {
    return {
      ...base,
      decision: "preserve" as const,
      meanings: { previous: prior, current: preserved },
      repair: null,
      explanation:
        "No source change needs a repair. Readiness and live answerability stay independent.",
    }
  }
  const write = Match.value(input.pullRequest.state).pipe(
    Match.when("competing", () => "none" as const),
    Match.when("superseded", () => "none" as const),
    Match.when("open-feature", () => "feature-pr" as const),
    Match.when("open-repair", () => "repair-branch" as const),
    Match.orElse(() => "repair-branch" as const),
  )
  const branch =
    write === "feature-pr"
      ? (input.pullRequest.branch ??
        repairBranch(input.questionId, input.questionRevision))
      : repairBranch(input.questionId, input.questionRevision)
  return {
    ...base,
    decision: "repair" as const,
    meanings: { previous: prior, current: preserved },
    opensInstrumentation: write !== "none",
    repair: {
      count: 1 as const,
      write,
      branch: write === "none" ? null : branch,
      test:
        write === "none"
          ? null
          : `test/flowmark-${input.questionId.replaceAll("/", "-")}.test.ts`,
    },
    explanation:
      write === "none"
        ? "A competing or superseded pull request already owns this change. Repeated triggers stay one repair and no new instrumentation is opened."
        : "One repair covers every trigger for this installation, behavior, question and revision. The test must include the counterexample.",
  }
}
