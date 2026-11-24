import type {
  DeployedArtifactMapping,
  RuntimeQuestion,
  StoredRuntimeObservation,
} from "@flowmarkdev/core"
import { questionProbeIds } from "@flowmarkdev/core"
import { Array, Effect, Option } from "effect"
import {
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"
import type { ProjectReader } from "../models/project-reader.js"
import {
  classifyQuestionDistinction,
  questionRecommendedAction,
} from "../rules/assess-question-fixture.js"
import { GetProjectWorkflowData } from "./get-project-workflow-data.js"

const RECENT_CONTEXT_SAMPLE = 4
const QUESTION_PAGE_SIZE = 25
const QUESTION_SCAN_CAP = 100
const QUESTION_EVENT_LIMIT = 25

export type SelectedQuestionCase = Readonly<{
  readonly runId: string
  readonly startedAt: string
  readonly status: string
  readonly outcome: string | null
  readonly distinction: "same-change" | "different-change"
  readonly reason: string
  readonly eventIds: readonly string[]
  readonly examinedRank: number
}>

export type QuestionEvidenceSelection = Readonly<{
  readonly deployment: DeployedArtifactMapping
  readonly sameChange: SelectedQuestionCase | null
  readonly differentChange: SelectedQuestionCase | null
  readonly gap: Readonly<{
    readonly reason: string
    readonly recommendedAction: ReturnType<typeof questionRecommendedAction>
  }> | null
  readonly selection: Readonly<{
    readonly examinedRuns: number
    readonly eligibleRuns: number
    readonly recentSampleSize: number
    readonly contraryBeyondRecentSample: boolean
    readonly truncated: boolean
    readonly scanLimit: number
  }>
}>

const probeSitesDeclared = (
  deployment: DeployedArtifactMapping,
  question: RuntimeQuestion,
) =>
  Array.every(questionProbeIds(question), (probeId) =>
    Array.some(
      deployment.manifest.probes,
      (probe) =>
        probe.probeId === probeId &&
        probe.location.kind === "source" &&
        probe.behaviorId === question.behaviorId &&
        probe.behaviorRevision === question.behaviorRevision,
    ),
  )

const observationsForRun = (
  events: ReadonlyArray<{
    readonly id: string
    readonly runtimeObservation?: StoredRuntimeObservation | null
  }>,
  context: Readonly<{
    readonly bindingId: string
    readonly deploymentId: string
    readonly artifactDigest: string
    readonly behaviorId: string
  }>,
) =>
  Array.getSomes(
    Array.map(events, (event) => {
      const stored = event.runtimeObservation
      if (!stored || stored.binding.status !== "bound") {
        return Option.none()
      }
      const probe = stored.observation.probe
      if (
        stored.binding.behaviorId !== context.behaviorId ||
        !probe ||
        probe.bindingId !== context.bindingId ||
        probe.deploymentId !== context.deploymentId ||
        probe.artifactDigest !== context.artifactDigest
      ) {
        return Option.none()
      }
      return Option.some({ eventId: event.id, stored })
    }),
  )

type QuestionEvidenceError = PersistenceError | Unauthorized | InvalidInput

export const selectQuestionEvidence: (
  reader: ProjectReader,
  window: { readonly startedAfter: string; readonly startedBefore: string },
  deployment: DeployedArtifactMapping,
  question: RuntimeQuestion,
) => Effect.Effect<
  QuestionEvidenceSelection,
  QuestionEvidenceError,
  GetProjectWorkflowData
> = Effect.fn("selectQuestionEvidence")(
  function* (reader, window, deployment, question) {
    const reads = yield* GetProjectWorkflowData
    if (!probeSitesDeclared(deployment, question)) {
      return {
        deployment,
        sameChange: null,
        differentChange: null,
        gap: {
          reason: "fixture-mapping-changed",
          recommendedAction: questionRecommendedAction(
            "fixture-mapping-changed",
          ),
        },
        selection: {
          examinedRuns: 0,
          eligibleRuns: 0,
          recentSampleSize: RECENT_CONTEXT_SAMPLE,
          contraryBeyondRecentSample: false,
          truncated: false,
          scanLimit: QUESTION_SCAN_CAP,
        },
      } satisfies QuestionEvidenceSelection
    }
    const mapping = {
      manifestDigest: deployment.manifestDigest,
      environment: deployment.environment,
    }
    const checkContext = {
      allowedChangeNamespaces: [question.changeNamespace],
      environment: deployment.environment,
      bindingId: deployment.bindingId,
      deploymentId: deployment.deploymentId,
      artifactDigest: deployment.manifest.artifactDigest,
      sourceRevision: deployment.manifest.revision,
    }
    const observationContext = {
      bindingId: deployment.bindingId,
      deploymentId: deployment.deploymentId,
      artifactDigest: deployment.manifest.artifactDigest,
      behaviorId: question.behaviorId,
    }
    type ScanState = {
      readonly cursor?: string
      readonly examinedRuns: number
      readonly eligibleRuns: number
      readonly truncated: boolean
      readonly contraryBeyondRecentSample: boolean
      readonly sameChange: SelectedQuestionCase | null
      readonly differentChange: SelectedQuestionCase | null
      readonly latestInconclusive: string | null
    }
    const scanRuns: (
      state: ScanState,
    ) => Effect.Effect<
      ScanState,
      QuestionEvidenceError,
      GetProjectWorkflowData
    > = Effect.fn("selectQuestionEvidence.scanRuns")(function* (
      state: ScanState,
    ) {
      if (state.examinedRuns >= QUESTION_SCAN_CAP) {
        return state
      }
      const page = yield* reads.listRuns(reader, {
        ...window,
        namespace: "application",
        workflow: question.scope.workflow,
        executionSelector: {
          bindingId: deployment.bindingId,
          deploymentId: deployment.deploymentId,
          artifactDigest: deployment.manifest.artifactDigest,
          behaviorId: question.behaviorId,
        },
        limit: QUESTION_PAGE_SIZE,
        cursor: state.cursor,
      })
      if (page.runs.length === 0) {
        return { ...state, eligibleRuns: page.total }
      }
      const outcomes = yield* Effect.forEach(
        page.runs,
        Effect.fn("selectQuestionEvidence.readRun")(function* (run, index) {
          const examinedRank = state.examinedRuns + index + 1
          const observed = yield* reads.runEventPage(reader, {
            runId: run.id,
            observationsOnly: true,
            limit: QUESTION_EVENT_LIMIT,
          })
          if (
            observed.nextCursor !== null ||
            observed.totalEvents !== observed.events.length
          ) {
            return { kind: "truncated-event-page" as const, examinedRank }
          }
          const matched = observationsForRun(
            observed.events,
            observationContext,
          )
          const observations = Array.map(matched, ({ stored }) => stored)
          if (observations.length === 0) {
            return { kind: "skip" as const, examinedRank }
          }
          const classified = classifyQuestionDistinction(
            observations,
            question,
            checkContext,
            mapping,
          )
          if (classified.status === "inconclusive") {
            return {
              kind: "inconclusive" as const,
              reason: classified.reason,
              examinedRank,
            }
          }
          return {
            kind: "observed" as const,
            examinedRank,
            case: {
              runId: run.id,
              startedAt: run.startedAt,
              status: run.status,
              outcome: run.outcome ?? null,
              distinction: classified.distinction,
              reason: classified.reason,
              eventIds: Array.map(matched, ({ eventId }) => eventId),
              examinedRank,
            },
          }
        }),
        { concurrency: 2 },
      )
      let sameChange = state.sameChange
      let differentChange = state.differentChange
      let latestInconclusive = state.latestInconclusive
      let contraryBeyondRecentSample = state.contraryBeyondRecentSample
      let truncated = state.truncated
      if (outcomes.some((item) => item.kind === "truncated-event-page")) {
        truncated = true
      }
      Array.forEach(outcomes, (outcome) => {
        if (outcome.kind === "inconclusive") {
          latestInconclusive = outcome.reason
          return
        }
        if (outcome.kind !== "observed") {
          return
        }
        if (outcome.case.distinction === "same-change" && sameChange === null) {
          sameChange = outcome.case
        }
        if (
          outcome.case.distinction === "different-change" &&
          differentChange === null
        ) {
          differentChange = outcome.case
          contraryBeyondRecentSample =
            contraryBeyondRecentSample ||
            outcome.examinedRank > RECENT_CONTEXT_SAMPLE
        }
      })
      const examinedRuns = state.examinedRuns + page.runs.length
      const next: ScanState = {
        cursor: page.nextCursor ?? undefined,
        examinedRuns,
        eligibleRuns: page.total,
        truncated,
        contraryBeyondRecentSample,
        sameChange,
        differentChange,
        latestInconclusive,
      }
      const foundBoth =
        sameChange !== null &&
        differentChange !== null &&
        examinedRuns >= RECENT_CONTEXT_SAMPLE
      if (
        foundBoth ||
        page.nextCursor === null ||
        examinedRuns >= QUESTION_SCAN_CAP
      ) {
        return {
          ...next,
          truncated: truncated || examinedRuns >= QUESTION_SCAN_CAP,
        }
      }
      return yield* scanRuns(next)
    })
    const final = yield* scanRuns({
      examinedRuns: 0,
      eligibleRuns: 0,
      truncated: false,
      contraryBeyondRecentSample: false,
      sameChange: null,
      differentChange: null,
      latestInconclusive: null,
    })
    const {
      examinedRuns,
      eligibleRuns,
      contraryBeyondRecentSample,
      sameChange,
      differentChange,
      latestInconclusive,
    } = final
    const truncated =
      final.truncated ||
      (examinedRuns >= QUESTION_SCAN_CAP && eligibleRuns > QUESTION_SCAN_CAP)
    const gap =
      sameChange === null && differentChange === null
        ? {
            reason: latestInconclusive ?? "missing-observation",
            recommendedAction: questionRecommendedAction(
              latestInconclusive ?? "missing-observation",
            ),
          }
        : sameChange === null || differentChange === null
          ? {
              reason: latestInconclusive ?? "missing-observation",
              recommendedAction: questionRecommendedAction(
                latestInconclusive ?? "missing-observation",
              ),
            }
          : null
    return {
      deployment,
      sameChange,
      differentChange,
      gap,
      selection: {
        examinedRuns,
        eligibleRuns,
        recentSampleSize: RECENT_CONTEXT_SAMPLE,
        contraryBeyondRecentSample,
        truncated,
        scanLimit: QUESTION_SCAN_CAP,
      },
    } satisfies QuestionEvidenceSelection
  },
)
