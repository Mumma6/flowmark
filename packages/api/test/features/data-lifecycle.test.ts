import { Effect, Layer, Redacted, Schema } from "effect"
import { describe, expect, it, vi } from "vitest"
import {
  ErasureScopeSchema,
  type ErasureOperation,
} from "../../src/features/data-lifecycle/contracts.js"
import {
  DataLifecycle,
  LifecycleReauthentication,
} from "../../src/features/data-lifecycle/ports/data-lifecycle.js"
import { ManageDataLifecycle } from "../../src/features/data-lifecycle/use-cases/manage-data-lifecycle.js"

const operation: ErasureOperation = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  projectName: "Bookings",
  scope: { kind: "project" },
  counts: {
    runs: 0,
    events: 0,
    apiKeys: 1,
    browserKeys: 0,
    configurations: 0,
    latestStart: null,
  },
  state: "purging",
  phase: 0,
  deletedEvents: 0,
  deletedRuns: 0,
  failureCode: null,
  expiresAt: "2026-11-13T00:00:00Z",
}
const identity = {
  userId: "owner",
  sessionId: "current-session",
  verifiedAt: Date.now(),
}
const setup = (verified = identity, allowed = true) => {
  const confirm = vi.fn(() => Effect.succeed(operation))
  const verify = vi.fn(() => Effect.succeed(verified))
  const live = ManageDataLifecycle.layer.pipe(
    Layer.provide(
      Layer.succeed(DataLifecycle, {
        preview: () => Effect.succeed(operation),
        status: () => Effect.succeed(operation),
        confirm,
        resume: () => Effect.succeed(operation),
        cancel: () => Effect.succeed(operation),
        reauthenticationBudget: () => Effect.succeed(allowed),
      }),
    ),
  )
  const execute = Effect.flatMap(ManageDataLifecycle, (manage) =>
    manage.confirm(
      "owner",
      operation.projectId,
      operation.id,
      operation.projectName,
      Redacted.make("synthetic-password"),
    ),
  ).pipe(
    Effect.provide(live),
    Effect.provideService(LifecycleReauthentication, { verify }),
  )
  return { confirm, verify, execute }
}
describe("lifecycle trust boundary", () => {
  it("verifies identity before calling persistence", async () => {
    const test = setup({ ...identity, verifiedAt: Date.now() })
    expect(await Effect.runPromise(test.execute)).toBe(operation)
    expect(test.verify).toHaveBeenCalledOnce()
    expect(test.confirm).toHaveBeenCalledOnce()
  })
  it.each([
    { ...identity, userId: "foreign" },
    { ...identity, sessionId: "" },
    { ...identity, verifiedAt: Number.NaN },
    { ...identity, verifiedAt: Date.now() - 600_000 },
    { ...identity, verifiedAt: Date.now() + 600_000 },
  ])(
    "rejects mismatched, missing or stale provider identity",
    async (verified) => {
      const test = setup(verified)
      await expect(Effect.runPromise(test.execute)).rejects.toMatchObject({
        _tag: "Unauthorized",
      })
      expect(test.confirm).not.toHaveBeenCalled()
    },
  )
  it("stops before password verification when the actor budget is exhausted", async () => {
    const test = setup(identity, false)
    await expect(Effect.runPromise(test.execute)).rejects.toMatchObject({
      _tag: "ManagementRateLimited",
    })
    expect(test.verify).not.toHaveBeenCalled()
    expect(test.confirm).not.toHaveBeenCalled()
  })
  it.each([
    { kind: "runs", runIds: [] },
    { kind: "runs", runIds: [operation.id, operation.id] },
    {
      kind: "workflow",
      workflow: "booking",
      after: "2026-11-10T00:00:00Z",
      before: "2026-11-01T00:00:00Z",
    },
    {
      kind: "workflow",
      workflow: "booking",
      after: "2026-11-01",
      before: "2026-11-10",
    },
    { kind: "project", runIds: [operation.id] },
    { kind: "unknown" },
  ])("rejects invalid scopes without widening them", (input) => {
    expect(
      Schema.decodeUnknownResult(ErasureScopeSchema, {
        onExcessProperty: "error",
      })(input)._tag,
    ).toBe("Failure")
  })
})
