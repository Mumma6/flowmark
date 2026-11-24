import type {
  DeployedArtifactMapping,
  RuntimeQuestion,
  StoredRuntimeObservation,
} from "@flowmarkdev/core"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import declarationImport from "../../../../examples/questions/committed-receipt.json"
import type { GetProjectWorkflowDataService } from "../../src/features/workflows/use-cases/get-project-workflow-data.js"

const declaration = declarationImport as unknown as Extract<
  RuntimeQuestion,
  { predicate: "receipt-for-same-change" }
>
import { GetProjectWorkflowData } from "../../src/features/workflows/use-cases/get-project-workflow-data.js"
import { User } from "../../src/features/workflows/models/project-reader.js"
import { selectQuestionEvidence } from "../../src/features/workflows/use-cases/select-question-evidence.js"

const deployment = {
  bindingId: "00000000-0000-4000-8000-000000000001",
  deploymentId: "receipt-live",
  environment: "production",
  service: declaration.scope.service,
  manifestDigest: "sha256:" + "a".repeat(64),
  manifest: {
    version: 1 as const,
    repository: declaration.scope.repository,
    revision: "a".repeat(40),
    artifactDigest: "sha256:" + "a".repeat(64),
    probes: [
      {
        probeId: declaration.requestProbe,
        behaviorId: declaration.behaviorId,
        behaviorRevision: declaration.behaviorRevision,
        location: {
          kind: "source" as const,
          path: "src/request.ts",
          symbol: "report",
        },
      },
      {
        probeId: declaration.committedReceiptProbe,
        behaviorId: declaration.behaviorId,
        behaviorRevision: declaration.behaviorRevision,
        location: {
          kind: "source" as const,
          path: "src/receipt.ts",
          symbol: "commit",
        },
      },
    ],
  },
  receivedAt: "2026-11-01T00:00:00.000Z",
} satisfies DeployedArtifactMapping

const binding = {
  status: "bound" as const,
  behaviorId: declaration.behaviorId,
  behaviorRevision: declaration.behaviorRevision,
  manifestDigest: deployment.manifestDigest,
  environment: deployment.environment,
  revision: deployment.manifest.revision,
}

const reference = {
  kind: "change" as const,
  namespace: declaration.changeNamespace,
  digest: "hmac-sha256:" + "a".repeat(64),
}
const otherReference = {
  ...reference,
  digest: "hmac-sha256:" + "b".repeat(64),
}

const observation = (
  probeId: string,
  digest = reference.digest,
): StoredRuntimeObservation => ({
  binding,
  observation: {
    kind: "observation",
    probe: {
      bindingId: deployment.bindingId,
      deploymentId: deployment.deploymentId,
      artifactDigest: deployment.manifest.artifactDigest,
      probeId,
    },
    references: [
      { kind: "change" as const, namespace: reference.namespace, digest },
    ],
  },
})

describe("selectQuestionEvidence", () => {
  it("finds a contrary case beyond the recent sample window", async () => {
    const runs = Array.from({ length: 5 }, (_, index) => ({
      id: `run-${index + 1}`,
      externalId: `run-${index + 1}`,
      workflow: declaration.scope.workflow,
      startedAt: `2026-11-0${index + 1}T00:00:00.000Z`,
      status: "Completed",
      durationMs: 10,
      step: null,
      result: null,
      outcome: null,
      correlationId: null,
      parentRunId: null,
      environment: "production",
      release: null,
      failCode: null,
    }))
    const queries = {
      listRuns: () =>
        Effect.succeed({
          runs,
          total: runs.length,
          nextCursor: null,
          limit: 25,
        }),
      runEventPage: (_reader: unknown, query: { runId: string }) => {
        const linked =
          query.runId !== "run-5"
            ? [
                observation(declaration.requestProbe),
                observation(declaration.committedReceiptProbe),
              ]
            : [
                observation(declaration.requestProbe),
                observation(
                  declaration.committedReceiptProbe,
                  otherReference.digest,
                ),
              ]
        return Effect.succeed({
          events: linked.map((stored, index) => ({
            id: `${query.runId}-event-${index + 1}`,
            runtimeObservation: stored,
          })),
          totalEvents: linked.length,
          nextCursor: null,
        })
      },
    }
    const reader = User({ userId: "user", projectId: "project" })
    const result = await Effect.runPromise(
      selectQuestionEvidence(
        reader,
        {
          startedAfter: "2026-11-01T00:00:00.000Z",
          startedBefore: "2026-11-30T00:00:00.000Z",
        },
        deployment,
        declaration,
      ).pipe(
        Effect.provideService(
          GetProjectWorkflowData,
          queries as unknown as GetProjectWorkflowDataService,
        ),
      ),
    )
    expect(result.sameChange).toMatchObject({ runId: "run-1" })
    expect(result.differentChange).toMatchObject({
      runId: "run-5",
      examinedRank: 5,
    })
    expect(result.selection).toMatchObject({
      contraryBeyondRecentSample: true,
      examinedRuns: 5,
      scanLimit: 100,
    })
    expect(result.gap).toBeNull()
  })
})
