import { Array, Match } from "effect"
import { assessLiveCoverage } from "./coverage-assessment.js"
import { planEvidenceReview } from "./evidence-review.js"
import { planObservationRepair } from "./observation-repair.js"
import { maintainQuestion } from "./question-maintenance.js"
import { evaluateRelease } from "./release-evaluation.js"

const release = `sha256:${"c".repeat(64)}`
const successor = `sha256:${"d".repeat(64)}`
const questionId = "warehouse.short-pick"
const repository = "warehouse-transfers"
const behaviorRevision = "dock-handoff-v2"
const test = "packages/core/test/independent-lifecycle.test.ts"
const citation = "https://flowmark.example/citations/warehouse-short-pick"
const occurredAt = "2026-11-01T01:00:00.000Z"

const site = {
  behaviorRevision,
  probeId: "dock.confirm",
  path: "src/dock/confirm-transfer.ts",
}

const maintenance = (
  live: {
    readonly deployment: "none" | "repaired"
    readonly eligibleObservations: number
    readonly mature: boolean
  },
  change: "unchanged" | "link-broken" = "unchanged",
) =>
  maintainQuestion({
    installationId: "warehouse-local",
    repository,
    behaviorId: "dock-handoff",
    questionId,
    questionRevision: 2,
    previous: { ...site, path: "src/pick/acknowledge-transfer.ts" },
    current: { ...site, change },
    exclusion: "none",
    access: "authorized",
    triggers: [
      { kind: "source", key: "confirm-transfer" },
      { kind: "deployment", key: "deploy-successor" },
      { kind: "traffic", key: "dock-window" },
    ],
    pullRequest: { state: "none", branch: null },
    fixtureReadback: "verified",
    live,
    support: "current",
  })

const coverage = (kind: "resolution" | "loss") =>
  assessLiveCoverage({
    questionId,
    questionRevision: 2,
    release: successor,
    behaviorRevision,
    environment: "fixture",
    provenance: "fixture",
    populationSource: { id: "dock-outbox", kind: "outbox" },
    window: {
      start: "2026-11-01T00:00:00.000Z",
      end: "2026-11-02T00:00:00.000Z",
    },
    maturityDelayMs: 0,
    observedAt: "2026-11-02T00:00:00.000Z",
    supportExpiresAt: null,
    sampling: "complete",
    join: "case-handle",
    drilldownLimit: 4,
    permittedHandles: ["transfer-ok", "transfer-gap"],
    discovery: "matched",
    readiness: "verified",
    population: [
      {
        handle: kind === "loss" ? "transfer-gap" : "transfer-ok",
        eligibleAt: occurredAt,
      },
    ],
    deliveries: [
      {
        eventId: "00000000-0000-4000-8000-000000000021",
        handle: kind === "loss" ? "transfer-gap" : "transfer-ok",
        questionId,
        questionRevision: 2,
        release: successor,
        environment: "fixture",
        behaviorRevision,
        occurredAt,
        admissible: true,
        mature: true,
        outcome: kind === "loss" ? null : "stocked",
        confirmation: null,
        kind,
      },
    ],
  })

const releaseInput = (
  business: "intended" | "contrary" | "unknown",
  access: "authorized" | "revoked" = "authorized",
  citationStatus: "open" | "expired" = "open",
) => ({
  questionId,
  questionRevision: 2,
  test,
  guarantee: "A short pick stays distinct from a late dock confirmation.",
  bindingId: "11111111-1111-4111-8111-111111111111",
  intendedBehaviorRevision: behaviorRevision,
  citation: {
    status: citationStatus,
    url: citationStatus === "open" ? citation : null,
  },
  access,
  population: "known-compatible" as const,
  rollout: "single" as const,
  baseline: "present" as const,
  maturity: "mature" as const,
  artifacts: [
    {
      artifactDigest: release,
      deploymentId: "deploy-baseline",
      role: "baseline" as const,
    },
    {
      artifactDigest: successor,
      deploymentId: "deploy-successor",
      role: "successor" as const,
    },
  ],
  cases: [
    {
      handle: Match.value(business).pipe(
        Match.when("contrary", () => "transfer-short" as const),
        Match.when("unknown", () => "transfer-unseen" as const),
        Match.when("intended", () => "transfer-ok" as const),
        Match.exhaustive,
      ),
      artifactDigest: successor,
      deploymentId: "deploy-successor",
      behaviorRevision,
      technical: "succeeded" as const,
      business,
      mature: true,
    },
  ],
})

/**
 * Walk the warehouse handoff through the existing memory checks.
 * The record is a local fixture. It is not an observed production case.
 */
export function exerciseWarehouseLifecycle() {
  const observation = planObservationRepair({
    questionId,
    questionRevision: 1,
    repository,
    gap: "missing-observation",
    access: "authorized",
    traffic: "fixture-ready",
    approvedNamespaces: ["transfer"],
    requestedNamespace: "transfer",
    reportingSite: "src/dock/confirm-transfer.ts",
    maxOverheadMs: 5,
    attempt: 1,
  })
  const readback = maintenance({
    deployment: "none",
    eligibleObservations: 0,
    mature: false,
  })
  const answerable = maintenance({
    deployment: "repaired",
    eligibleObservations: 1,
    mature: true,
  })
  const observed = coverage("resolution")
  const loss = coverage("loss")
  const review = planEvidenceReview({
    decision: "Keep a short pick distinct from a late dock confirmation.",
    guarantee: "A short pick stays distinct from a late dock confirmation.",
    test,
    contrary:
      "The dock confirmed a transfer the pick had already marked short.",
    missing: "No eligible dock traffic had matured on the first connection.",
    expectation: "application-intent",
    synthetic: true,
    citation: { status: "open", url: citation },
    protectedText: ["aisle-secret"],
  })
  const intended = evaluateRelease(releaseInput("intended"))
  const contrary = evaluateRelease({
    ...releaseInput("contrary"),
    cases: [
      ...releaseInput("contrary").cases,
      ...releaseInput("unknown").cases,
    ],
  })
  const expired = evaluateRelease(
    releaseInput("intended", "authorized", "expired"),
  )
  const revoked = evaluateRelease(releaseInput("intended", "revoked"))
  const linkage = maintenance(
    { deployment: "repaired", eligibleObservations: 1, mature: true },
    "link-broken",
  )
  const reuse = planObservationRepair({
    questionId,
    questionRevision: 2,
    repository,
    gap: "already-answered",
    access: "authorized",
    traffic: "fixture-ready",
    approvedNamespaces: ["transfer"],
    maxOverheadMs: 5,
    attempt: 2,
  })
  const unsupported = planObservationRepair({
    questionId,
    questionRevision: 2,
    repository,
    gap: "restricted-field",
    access: "authorized",
    traffic: "fixture-ready",
    approvedNamespaces: ["transfer"],
    maxOverheadMs: 5,
    attempt: 1,
  })
  const listed = Array.map(
    [...contrary.supporting, ...contrary.contrary],
    (item) => item.handle,
  )
  return {
    application: "warehouse-transfer" as const,
    repository,
    environment: "local-fixture" as const,
    productionClaim: false as const,
    sessionsShareProtectedTranscript: false as const,
    first: {
      history: 0 as const,
      manualIntervention: Match.value(observation.status).pipe(
        Match.when("owner-approval", () => "owner" as const),
        Match.orElse(() => "none" as const),
      ),
      remedy: observation.remedy,
      overheadMs: observation.overheadMs,
      production: observation.production,
      readiness: readback.readiness,
      answerability: readback.answerability,
    },
    second: {
      retrieval: answerable.retrieval.status,
      caseLabel: answerable.retrieval.caseLabel,
      coverage: observed.answerability.status,
      review: review.status,
      release: intended.status,
      causalClaim: intended.causalClaim,
      contrary: contrary.status,
      unknownRemainsUnlisted: !listed.includes("transfer-unseen"),
    },
    loss: loss.answerability.status,
    linkage: {
      decision: linkage.decision,
      count: linkage.repair?.count ?? 0,
    },
    idempotent: {
      remedy: reuse.remedy,
      overheadMs: reuse.overheadMs,
      revision: reuse.questionRevision,
      merged: reuse.merged,
    },
    citation: expired.reason,
    revocation: revoked.status,
    unsupported: unsupported.status,
  }
}
