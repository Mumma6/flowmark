import {
  isRuntimeQuestionSuccessor,
  runtimeQuestionCases,
  type RuntimeQuestionCheck,
} from "@flowmarkdev/core"
import { Array, Effect, Match, Option } from "effect"
import type { ProjectReader } from "../models/project-reader.js"
import {
  fixtureReadiness,
  verifyQuestionCase,
} from "../rules/assess-question-fixture.js"
import { GetProjectWorkflowData } from "./get-project-workflow-data.js"

export const checkRuntimeQuestion = Effect.fn("checkRuntimeQuestion")(
  function* (reader: ProjectReader, input: RuntimeQuestionCheck) {
    const { question, runs } = input
    const reads = yield* GetProjectWorkflowData
    // This path applies the existing diagnostic grant even for excluded or missing fixtures.
    const scope = yield* reads.artifactMappings(reader, {
      repository: question.scope.repository,
      environment: input.environment,
      receipt: { bindingId: input.bindingId, deploymentId: input.deploymentId },
    })
    if (
      question.id !== input.questionId ||
      question.revision !== input.questionRevision ||
      question.fixture !== input.fixture
    ) {
      return fixtureReadiness("stale", "fixture-declaration-mismatch")
    }
    if (
      input.previousQuestion &&
      !isRuntimeQuestionSuccessor(input.previousQuestion, question)
    ) {
      return fixtureReadiness("stale", "question-revision-conflict")
    }
    if (!input.allowedChangeNamespaces.includes(question.changeNamespace)) {
      return fixtureReadiness("failed", "field-outside-fixture-policy")
    }
    if (question.excludedReason) {
      if (question.excludedReason !== input.approvedExclusion) {
        return fixtureReadiness("failed", "unapproved-exclusion")
      }
      return fixtureReadiness("excluded", question.excludedReason)
    }
    if (!runs) {
      return fixtureReadiness("missing", "fixture-runs-missing")
    }
    const [mapping] = scope.mappings
    if (!mapping) {
      return fixtureReadiness("missing", "deployment-receipt-missing")
    }
    const { manifest } = mapping
    if (
      mapping.service !== question.scope.service ||
      manifest.artifactDigest !== input.artifactDigest ||
      manifest.revision !== input.sourceRevision ||
      !Array.every(
        [question.requestProbe, question.committedReceiptProbe],
        (site) =>
          Array.some(
            manifest.probes,
            (p) =>
              p.probeId === site &&
              p.location.kind === "source" &&
              p.behaviorId === question.behaviorId &&
              p.behaviorRevision === question.behaviorRevision,
          ),
      )
    ) {
      return fixtureReadiness("stale", "fixture-mapping-changed")
    }
    const cases = yield* Effect.forEach(
      runtimeQuestionCases,
      Effect.fn("checkRuntimeQuestion.readCase")(function* (fixtureCase) {
        const runId = runs[fixtureCase]
        const summary = yield* reads.runInvestigationSummary(reader, runId)
        if (
          summary.workflow !== question.scope.workflow ||
          summary.environment !== input.environment
        ) {
          return fixtureReadiness("stale", "wrong-fixture-scope", fixtureCase)
        }
        const expectedStatus = Match.value(fixtureCase).pipe(
          Match.when("rollback", () => "Failed" as const),
          Match.whenOr("linked", "otherRequest", () => "Completed" as const),
          Match.exhaustive,
        )
        if (summary.status !== expectedStatus) {
          return fixtureReadiness(
            "failed",
            "fixture-terminal-state",
            fixtureCase,
          )
        }
        const page = yield* reads.runEventPage(reader, {
          runId,
          observationsOnly: true,
          limit: 25,
        })
        if (
          page.nextCursor !== null ||
          page.totalEvents !== page.events.length
        ) {
          return fixtureReadiness("failed", "incomplete-read", fixtureCase)
        }
        const observations = Array.getSomes(
          Array.map(page.events, (event) =>
            Option.fromNullishOr(event.runtimeObservation),
          ),
        )
        if (observations.length !== page.events.length) {
          return fixtureReadiness("failed", "incomplete-read", fixtureCase)
        }
        return verifyQuestionCase(input, mapping, fixtureCase, observations)
      }),
    )
    return Array.findFirst(
      cases,
      (checked) => checked.status !== "verified",
    ).pipe(
      Option.getOrElse(() =>
        fixtureReadiness("verified", "persisted-fixture-distinction"),
      ),
    )
  },
)
