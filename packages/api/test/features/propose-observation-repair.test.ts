import type {
  DeployedArtifactMapping,
  RuntimeQuestion,
  StoredRuntimeObservation,
} from "@flowmarkdev/core"
import { Effect, Exit } from "effect"
import { describe, expect, it } from "vitest"
import confirmationImport from "../../../../examples/questions/later-confirmation.json"
import declarationImport from "../../../../examples/questions/committed-receipt.json"
import { PersistenceError } from "../../src/errors.js"
import { GetProjectWorkflowData } from "../../src/features/workflows/use-cases/get-project-workflow-data.js"
import { Key } from "../../src/features/workflows/models/project-reader.js"
import type { GetProjectWorkflowDataService } from "../../src/features/workflows/use-cases/get-project-workflow-data.js"
import { proposeObservationRepair } from "../../src/features/workflows/use-cases/propose-observation-repair.js"

const receipt = declarationImport as unknown as Extract<
  RuntimeQuestion,
  { predicate: "receipt-for-same-change" }
>
const confirmation = confirmationImport as unknown as Extract<
  RuntimeQuestion,
  { predicate: "confirmation-for-same-change" }
>

const deploymentFor = (
  question: RuntimeQuestion,
  paths: readonly [string, string],
): DeployedArtifactMapping => ({
  bindingId: "00000000-0000-4000-8000-000000000001",
  deploymentId: "repair-live",
  environment: "production",
  service: question.scope.service,
  manifestDigest: "sha256:" + "a".repeat(64),
  receivedAt: "2026-11-02T00:00:00.000Z",
  manifest: {
    version: 1,
    repository: question.scope.repository,
    revision: "a".repeat(40),
    artifactDigest: "sha256:" + "a".repeat(64),
    probes: [
      {
        probeId:
          question.predicate === "receipt-for-same-change"
            ? question.requestProbe
            : question.attemptProbe,
        behaviorId: question.behaviorId,
        behaviorRevision: question.behaviorRevision,
        location: { kind: "source", path: paths[0], symbol: "attempt" },
      },
      {
        probeId:
          question.predicate === "receipt-for-same-change"
            ? question.committedReceiptProbe
            : question.confirmationProbe,
        behaviorId: question.behaviorId,
        behaviorRevision: question.behaviorRevision,
        location: { kind: "source", path: paths[1], symbol: "confirm" },
      },
    ],
  },
})

const bindingFor = (deployment: DeployedArtifactMapping) => ({
  status: "bound" as const,
  behaviorId: deployment.manifest.probes[0]?.behaviorId ?? "",
  behaviorRevision: "1",
  manifestDigest: deployment.manifestDigest,
  environment: deployment.environment,
  revision: deployment.manifest.revision,
})

const observation = (
  deployment: DeployedArtifactMapping,
  probeId: string,
  digest?: string,
): StoredRuntimeObservation => ({
  binding: bindingFor(deployment),
  observation: {
    kind: "observation",
    probe: {
      bindingId: deployment.bindingId,
      deploymentId: deployment.deploymentId,
      artifactDigest: deployment.manifest.artifactDigest,
      probeId,
    },
    references:
      digest === undefined
        ? []
        : [
            {
              kind: "change",
              namespace: "payment.request",
              digest,
            },
          ],
  },
})

const run = (id: string, workflow: string) => ({
  id,
  externalId: id,
  workflow,
  startedAt: "2026-11-03T00:00:00.000Z",
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
})

const reader = Key({ header: "Bearer key" })

const requestFor = (
  question: RuntimeQuestion,
  reportingSites: readonly string[],
) => ({
  question,
  repository: question.scope.repository,
  branch: "feature/confirm-link",
  access: "authorized" as const,
  traffic: "fixture-ready" as const,
  approvedNamespaces: [question.changeNamespace],
  reportingSites,
  maxOverheadMs: 10,
  attempt: 1,
  startedAfter: "2026-11-01T00:00:00.000Z",
  startedBefore: "2026-11-30T00:00:00.000Z",
  environment: "production",
})

const propose = (raw: unknown, queries: object) =>
  Effect.runPromiseExit(
    proposeObservationRepair(reader, raw).pipe(
      Effect.provideService(
        GetProjectWorkflowData,
        queries as unknown as GetProjectWorkflowDataService,
      ),
    ),
  )

describe("proposeObservationRepair", () => {
  it("proposes one permitted confirmation reference from a stored missing link", async () => {
    const deployment = deploymentFor(confirmation, [
      "src/attempt.ts",
      "src/confirm.ts",
    ])
    const same = "hmac-sha256:" + "a".repeat(64)
    const events = [
      observation(deployment, confirmation.attemptProbe, same),
      observation(deployment, confirmation.confirmationProbe),
    ]
    const result = await propose(requestFor(confirmation, ["src/confirm.ts"]), {
      artifactMappings: () =>
        Effect.succeed({ mappings: [deployment], truncated: false }),
      listRuns: () =>
        Effect.succeed({
          runs: [run("unlinked", confirmation.scope.workflow)],
          total: 1,
          nextCursor: null,
          limit: 25,
        }),
      runEventPage: () =>
        Effect.succeed({
          runId: "unlinked",
          events: events.map((stored, index) => ({
            id: `event-${index + 1}`,
            runtimeObservation: stored,
          })),
          totalEvents: events.length,
          nextCursor: null,
          limit: 25,
        }),
    })
    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) {
      expect(result.value).toMatchObject({
        status: "proposed",
        remedy: "add-permitted-reference",
        branch: "feature/confirm-link",
        merged: false,
        production: "pending",
        fields: ["payment.request"],
        files: [
          { path: "src/confirm.ts" },
          { path: "test/flowmark-payments.confirmation-for-attempt.test.ts" },
        ],
      })
      expect(result.value.test).toBe(
        "test/flowmark-payments.confirmation-for-attempt.test.ts",
      )
      expect(result.value.explanation).not.toContain(same)
    }
  })

  it("proposes no source edit when the stored question is already answered", async () => {
    const deployment = deploymentFor(confirmation, [
      "src/attempt.ts",
      "src/confirm.ts",
    ])
    const same = "hmac-sha256:" + "a".repeat(64)
    const other = "hmac-sha256:" + "b".repeat(64)
    const eventsFor = (runId: string) =>
      runId === "same"
        ? [
            observation(deployment, confirmation.attemptProbe, same),
            observation(deployment, confirmation.confirmationProbe, same),
          ]
        : [
            observation(deployment, confirmation.attemptProbe, same),
            observation(deployment, confirmation.confirmationProbe, other),
          ]
    const result = await propose(requestFor(confirmation, ["src/confirm.ts"]), {
      artifactMappings: () =>
        Effect.succeed({ mappings: [deployment], truncated: false }),
      listRuns: () =>
        Effect.succeed({
          runs: [
            run("same", confirmation.scope.workflow),
            run("other", confirmation.scope.workflow),
          ],
          total: 2,
          nextCursor: null,
          limit: 25,
        }),
      runEventPage: (_reader: unknown, query: { runId: string }) => {
        const events = eventsFor(query.runId)
        return Effect.succeed({
          runId: query.runId,
          events: events.map((stored, index) => ({
            id: `${query.runId}-${index + 1}`,
            runtimeObservation: stored,
          })),
          totalEvents: events.length,
          nextCursor: null,
          limit: 25,
        })
      },
    })
    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) {
      expect(result.value).toMatchObject({
        remedy: "reuse-event",
        files: [],
        fields: [],
        test: null,
      })
    }
  })

  it("rejects a caller-supplied gap before reading stored evidence", async () => {
    let reads = 0
    const result = await propose(
      {
        ...requestFor(confirmation, ["src/confirm.ts"]),
        gap: "missing-change-link",
      },
      {
        artifactMappings: () => {
          reads += 1
          return Effect.die("stored evidence should not be read")
        },
        listRuns: () => Effect.die("stored evidence should not be read"),
        runEventPage: () => Effect.die("stored evidence should not be read"),
      },
    )
    expect(reads).toBe(0)
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      expect(result.cause.toString()).toContain(
        "A caller-supplied diagnosis is not accepted.",
      )
    }
  })

  it("adds no capture for a denied, immature, or excluded read", async () => {
    const denied = await propose(
      { ...requestFor(receipt, ["src/receipt.ts"]), access: "denied" },
      {
        artifactMappings: () => Effect.die("denied read"),
        listRuns: () => Effect.die("denied read"),
        runEventPage: () => Effect.die("denied read"),
      },
    )
    const immature = await propose(
      {
        ...requestFor(confirmation, ["src/confirm.ts"]),
        traffic: "immature",
      },
      {
        artifactMappings: () =>
          Effect.succeed({
            mappings: [
              deploymentFor(confirmation, ["src/attempt.ts", "src/confirm.ts"]),
            ],
            truncated: false,
          }),
        listRuns: () =>
          Effect.succeed({
            runs: [],
            total: 0,
            nextCursor: null,
            limit: 25,
          }),
        runEventPage: () =>
          Effect.succeed({
            runId: "none",
            events: [],
            totalEvents: 0,
            nextCursor: null,
            limit: 25,
          }),
      },
    )
    const excluded = await propose(
      requestFor({ ...confirmation, excludedReason: "policy-excluded" }, [
        "src/confirm.ts",
      ]),
      {
        artifactMappings: () => Effect.die("excluded read"),
        listRuns: () => Effect.die("excluded read"),
        runEventPage: () => Effect.die("excluded read"),
      },
    )
    expect(Exit.isSuccess(denied) && denied.value).toMatchObject({
      status: "refused",
      remedy: "none",
      files: [],
    })
    expect(Exit.isSuccess(immature) && immature.value.explanation).toContain(
      "immature",
    )
    expect(Exit.isSuccess(excluded) && excluded.value).toMatchObject({
      status: "unsupported",
      remedy: "none",
      files: [],
    })
  })

  it("fails explicitly when stored evidence cannot be read", async () => {
    const result = await propose(requestFor(receipt, ["src/receipt.ts"]), {
      artifactMappings: () =>
        Effect.fail(
          new PersistenceError({
            operation: "ArtifactMappings",
            cause: "down",
          }),
        ),
      listRuns: () => Effect.die("not reached"),
      runEventPage: () => Effect.die("not reached"),
    })
    expect(Exit.isFailure(result)).toBe(true)
    if (Exit.isFailure(result)) {
      const text = result.cause.toString()
      expect(text).toContain("could not be read")
      expect(text).not.toContain("No safe source")
    }
  })

  it("uses the receipt site for a stored missing link on the receipt predicate", async () => {
    const deployment = deploymentFor(receipt, [
      "src/request.ts",
      "src/receipt.ts",
    ])
    const same = "hmac-sha256:" + "c".repeat(64)
    const events = [
      observation(deployment, receipt.requestProbe, same),
      observation(deployment, receipt.committedReceiptProbe),
    ]
    const result = await propose(requestFor(receipt, ["src/receipt.ts"]), {
      artifactMappings: () =>
        Effect.succeed({ mappings: [deployment], truncated: false }),
      listRuns: () =>
        Effect.succeed({
          runs: [run("receipt", receipt.scope.workflow)],
          total: 1,
          nextCursor: null,
          limit: 25,
        }),
      runEventPage: () =>
        Effect.succeed({
          runId: "receipt",
          events: events.map((stored, index) => ({
            id: `receipt-${index + 1}`,
            runtimeObservation: stored,
          })),
          totalEvents: events.length,
          nextCursor: null,
          limit: 25,
        }),
    })
    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) {
      expect(result.value.files[0]).toMatchObject({ path: "src/receipt.ts" })
      expect(result.value.remedy).toBe("add-permitted-reference")
    }
  })
})
