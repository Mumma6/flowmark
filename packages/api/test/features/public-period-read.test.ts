import { Effect, Layer, Result } from "effect"
import { expect, it, vi } from "vitest"
import { ReadPublicPeriod } from "../../src/features/public-reads/use-cases/read-period.js"
import { AuthorizeProject } from "../../src/features/project-access/use-cases/authorize-project.js"
import { PublicReadAdmission } from "../../src/features/public-reads/ports/public-read-admission.js"
import { WorkflowRepository } from "../../src/features/workflows/ports/workflow-repository.js"
import { Unauthorized } from "../../src/errors.js"
import { PublicReadFailure } from "../../src/features/public-reads/errors.js"

const input = {
  version: 1,
  kind: "period",
  projectId: "00000000-0000-4000-8000-000000000001",
  workflow: "invoice-review",
  currentStartedAfter: "2026-11-01T00:00:00.000Z",
  currentStartedBefore: "2026-11-08T00:00:00.000Z",
  previousStartedAfter: "2026-10-25T00:00:00.000Z",
  previousStartedBefore: "2026-11-01T00:00:00.000Z",
} as const
const window = (startedAfter: string, startedBefore: string) => ({
  startedAfter,
  startedBefore,
  totalRuns: 0,
  finishedRuns: 0,
  completedRuns: 0,
  failedRuns: 0,
  successRate: null,
  medianDurationMs: null,
  p95DurationMs: null,
})

const fixture = (unavailable = false) => {
  const periodRead = vi.fn(() =>
    unavailable
      ? Effect.fail(new PublicReadFailure({ code: "READ_UNAVAILABLE" }))
      : Effect.succeed({
          workflow: input.workflow,
          current: window(
            input.currentStartedAfter,
            input.currentStartedBefore,
          ),
          previous: window(
            input.previousStartedAfter,
            input.previousStartedBefore,
          ),
        }),
  )
  const authorize = vi.fn((header: string | null) =>
    header === "Bearer fm_read_valid"
      ? Effect.succeed(input.projectId)
      : Effect.fail(new Unauthorized({ permission: "read" })),
  )
  const consume = vi.fn(() => Effect.void)
  const layer = ReadPublicPeriod.layer.pipe(
    Layer.provide(Layer.mock(AuthorizeProject, { authorize })),
    Layer.provide(Layer.succeed(PublicReadAdmission, { consume })),
    Layer.provide(Layer.mock(WorkflowRepository, { periodRead })),
  )
  const read = (
    raw: unknown = input,
    header: string | null = "Bearer fm_read_valid",
  ) =>
    Effect.runPromise(
      Effect.result(
        Effect.flatMap(ReadPublicPeriod, (service) =>
          service.read(header, raw),
        ),
      ).pipe(Effect.provide(layer)),
    )
  return { read, periodRead, authorize, consume }
}
const failure = <A, E>(result: Result.Result<A, E>) =>
  Result.match(result, {
    onFailure: (error) => error,
    onSuccess: () => expect.fail("Expected failure"),
  })

it("returns explicit empty windows, null statistics, coverage and no continuation", async () => {
  const f = fixture()
  const result = Result.getOrThrow(await f.read())
  expect(result.selection).toEqual(input)
  expect(result.report.current.totalRuns).toBe(0)
  expect(result.report.current.medianDurationMs).toBeNull()
  expect(result.coverage).toEqual({
    currentOpenRuns: 0,
    previousOpenRuns: 0,
    previousWindowHasRuns: false,
    durationObservationCounts: null,
  })
  expect(result.continuation).toBeNull()
  expect(f.periodRead).toHaveBeenCalledWith(input.projectId, input)
})

it.each([
  [
    { ...input, projectId: "00000000-0000-4000-8000-000000000009" },
    "PROJECT_FORBIDDEN",
  ],
  [{ ...input, version: 2 }, "UNSUPPORTED_VERSION"],
  [{ ...input, kind: "business" }, "UNSUPPORTED_SELECTION"],
  [{ ...input, mode: "business" }, "UNSUPPORTED_SELECTION"],
  [{ ...input, revision: "unknown" }, "UNSUPPORTED_SELECTION"],
  [{ ...input, environment: "production" }, "UNSUPPORTED_SELECTION"],
  [{ ...input, peers: { days: 7 } }, "UNSUPPORTED_SELECTION"],
  [{ ...input, cursor: "foreign" }, "UNSUPPORTED_SELECTION"],
  [
    { ...input, currentStartedBefore: "2026-12-15T00:00:00.000Z" },
    "INVALID_REQUEST",
  ],
  [
    { ...input, previousStartedBefore: "2026-11-02T00:00:00.000Z" },
    "INVALID_REQUEST",
  ],
  [{ ...input, workflow: "" }, "INVALID_REQUEST"],
])(
  "rejects unsupported mode/filter/version or window before population reads",
  async (body, code) => {
    const f = fixture()
    expect(failure(await f.read(body))).toMatchObject({ code })
    expect(f.periodRead).not.toHaveBeenCalled()
  },
)

it.each([
  null,
  "Bearer fm_write_valid",
  "Bearer fm_browser_valid",
  "Bearer oauth",
  "Bearer fm_read_revoked",
])("requires the same live read-key authority (%s)", async (header) => {
  const f = fixture()
  expect(failure(await f.read(input, header))).toMatchObject({
    code: "UNAUTHORIZED",
  })
  expect(f.periodRead).not.toHaveBeenCalled()
})

it("does not turn unavailable aggregation into empty success", async () => {
  expect(failure(await fixture(true).read())).toMatchObject({
    code: "READ_UNAVAILABLE",
  })
})
