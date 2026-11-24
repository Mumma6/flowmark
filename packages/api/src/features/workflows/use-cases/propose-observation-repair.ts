import {
  StoredObservationRepairSchema,
  planObservationRepair,
  questionProbeIds,
  type DeployedArtifactMapping,
  type RepairGap,
  type RuntimeQuestion,
  type StoredObservationRepair,
} from "@flowmarkdev/core"
import { Array, Effect, Option, Schema } from "effect"
import { InvalidInput } from "../../../errors.js"
import type { ProjectReader } from "../models/project-reader.js"
import { selectQuestionEvidence } from "./select-question-evidence.js"
import { GetProjectWorkflowData } from "./get-project-workflow-data.js"

const callerSuppliedGap = (raw: unknown) =>
  typeof raw === "object" && raw !== null && Object.hasOwn(raw, "gap")

const unavailable = () =>
  new InvalidInput({
    cause: "Stored question evidence could not be read.",
  })

const repairGap = (reason: string): RepairGap | undefined => {
  if (reason === "missing-change-link" || reason === "missing-observation") {
    return reason
  }
  if (
    reason === "fixture-mapping-changed" ||
    reason === "observation-mapping-changed" ||
    reason === "unbound-observation" ||
    reason === "stale"
  ) {
    return "mapping-stale"
  }
  if (reason === "field-outside-fixture-policy") {
    return "restricted-field"
  }
  return undefined
}

const confirmationPath = (
  question: RuntimeQuestion,
  sites: StoredObservationRepair["reportingSites"],
  deploymentProbes: DeployedArtifactMapping["manifest"]["probes"],
) => {
  const confirmationProbe = questionProbeIds(question)[1]
  return Option.match(
    Array.findFirst(
      deploymentProbes,
      (probe) =>
        probe.probeId === confirmationProbe &&
        probe.location.kind === "source" &&
        sites.includes(probe.location.path),
    ),
    {
      onNone: () => undefined,
      onSome: (probe) =>
        probe.location.kind === "source" ? probe.location.path : undefined,
    },
  )
}

export const proposeObservationRepair = Effect.fn("proposeObservationRepair")(
  function* (reader: ProjectReader, raw: unknown) {
    if (callerSuppliedGap(raw)) {
      return yield* new InvalidInput({
        cause: "A caller-supplied diagnosis is not accepted.",
      })
    }
    const request = yield* Schema.decodeUnknownEffect(
      StoredObservationRepairSchema,
      { onExcessProperty: "error" },
    )(raw).pipe(
      Effect.mapError(
        () =>
          new InvalidInput({
            cause:
              "Observation repair input is outside the supported contract.",
          }),
      ),
    )
    if (request.question.scope.repository !== request.repository) {
      return yield* new InvalidInput({
        cause: "The question repository must match the requested repository.",
      })
    }
    const planned = (gap: RepairGap, reportingSite?: string) => ({
      ...planObservationRepair({
        questionId: request.question.id,
        questionRevision: request.question.revision,
        repository: request.repository,
        gap,
        access: request.access,
        traffic: request.traffic,
        approvedNamespaces: request.approvedNamespaces,
        requestedNamespace: request.question.changeNamespace,
        reportingSite,
        maxOverheadMs: request.maxOverheadMs,
        attempt: request.attempt,
      }),
      branch: request.branch,
    })
    if (
      request.access !== "authorized" ||
      request.question.excludedReason !== undefined
    ) {
      return planned(
        request.question.excludedReason === undefined
          ? "missing-observation"
          : "restricted-field",
      )
    }
    const reads = yield* GetProjectWorkflowData
    const scope = yield* reads
      .artifactMappings(reader, {
        repository: request.repository,
        environment: request.environment,
      })
      .pipe(Effect.mapError(() => unavailable()))
    const [attemptProbe, confirmationProbe] = questionProbeIds(request.question)
    const deployment = Array.findFirst(scope.mappings, (item) => {
      if (
        item.manifest.repository !== request.question.scope.repository ||
        item.service !== request.question.scope.service ||
        (request.environment !== undefined &&
          item.environment !== request.environment)
      ) {
        return false
      }
      return Array.every([attemptProbe, confirmationProbe], (probeId) =>
        Array.some(
          item.manifest.probes,
          (probe) =>
            probe.probeId === probeId &&
            probe.location.kind === "source" &&
            probe.behaviorId === request.question.behaviorId &&
            probe.behaviorRevision === request.question.behaviorRevision,
        ),
      )
    })
    if (Option.isNone(deployment)) {
      return yield* unavailable()
    }
    const selected = yield* selectQuestionEvidence(
      reader,
      {
        startedAfter: request.startedAfter,
        startedBefore: request.startedBefore,
      },
      deployment.value,
      request.question,
    ).pipe(Effect.mapError(() => unavailable()))
    const gap =
      selected.gap === null
        ? "already-answered"
        : repairGap(selected.gap.reason)
    if (gap === undefined) {
      return yield* new InvalidInput({
        cause: "The stored gap has no supported repair.",
      })
    }
    return planned(
      gap,
      confirmationPath(
        request.question,
        request.reportingSites,
        deployment.value.manifest.probes,
      ),
    )
  },
)
