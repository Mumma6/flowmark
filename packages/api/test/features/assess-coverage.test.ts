import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { InvalidInput, Unauthorized } from "../../src/errors.js"
import { Key } from "../../src/features/workflows/models/project-reader.js"
import { assessCoverage } from "../../src/features/workflows/use-cases/assess-coverage.js"
import {
  GetProjectWorkflowData,
  type GetProjectWorkflowDataService,
} from "../../src/features/workflows/use-cases/get-project-workflow-data.js"

const release = `sha256:${"a".repeat(64)}`
const input = {
  questionId: "payment.confirmation",
  questionRevision: 1,
  release,
  behaviorRevision: "1",
  environment: "production",
  provenance: "fixture",
  populationSource: { id: "outbox", kind: "outbox" },
  window: {
    start: "2026-11-01T00:00:00.000Z",
    end: "2026-11-02T00:00:00.000Z",
  },
  maturityDelayMs: 0,
  observedAt: "2026-11-02T00:00:00.000Z",
  supportExpiresAt: null,
  sampling: "complete",
  join: "case-handle",
  drilldownLimit: 8,
  permittedHandles: ["case-a"],
  population: [{ handle: "case-a", eligibleAt: "2026-11-01T01:00:00.000Z" }],
}
const event = {
  eventId: "00000000-0000-4000-8000-000000000001",
  handle: "case-a",
  kind: "observation" as const,
  artifactDigest: release,
  environment: "production",
  behaviorRevision: "1",
  occurredAt: "2026-11-01T02:00:00.000Z",
}
const run = (
  raw: unknown,
  coverageObservations: GetProjectWorkflowDataService["coverageObservations"],
) =>
  assessCoverage(Key({ header: "synthetic" }), raw).pipe(
    Effect.provideService(GetProjectWorkflowData, {
      coverageObservations,
    } as GetProjectWorkflowDataService),
  )

describe("stored coverage", () => {
  it("uses stored evidence and leaves absent persisted checks unknown", async () => {
    const result = await Effect.runPromise(
      run(input, (_, scope) => {
        expect(scope).toMatchObject({
          artifactDigest: release,
          environment: "production",
          behaviorRevision: "1",
        })
        return Effect.succeed({
          events: [
            event,
            { ...event, eventId: "00000000-0000-4000-8000-000000000002" },
          ],
          truncated: false,
        })
      }),
    )
    expect(result.discovery.status).toBe("unknown")
    expect(result.readiness.status).toBe("unknown")
    expect(result.answerability).toMatchObject({ resolved: 1, eligible: 1 })
  })
  it("withholds the rate on a truncated read", async () => {
    const result = await Effect.runPromise(
      run(input, () => Effect.succeed({ events: [event], truncated: true })),
    )
    expect(result.answerability.rate).toBeNull()
  })
  it.each(["deliveries", "discovery", "readiness", "stored"])(
    "rejects caller %s before reading",
    async (field) => {
      const result = await Effect.runPromise(
        run({ ...input, [field]: [] }, () => Effect.die("must not read")).pipe(
          Effect.flip,
        ),
      )
      expect(result).toBeInstanceOf(InvalidInput)
    },
  )
  it("propagates denied authorization without returning the population", async () => {
    const result = await Effect.runPromise(
      run(input, () =>
        Effect.fail(new Unauthorized({ permission: "read" })),
      ).pipe(Effect.flip),
    )
    expect(result).toBeInstanceOf(Unauthorized)
  })
})
