import { afterEach, expect, it, vi } from "vitest"
import { createFlowmarkReadClient } from "../src/reads/index.js"
import { periodReadEvidencePath } from "@flowmarkdev/core"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
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
const response = () => ({
  version: 1,
  mode: "technical",
  selection: input,
  observedAt: "2026-11-10T00:00:00.000Z",
  capabilities: ["technical_period_windows"],
  report: {
    workflow: input.workflow,
    current: window(input.currentStartedAfter, input.currentStartedBefore),
    previous: window(input.previousStartedAfter, input.previousStartedBefore),
  },
  coverage: {
    currentOpenRuns: 0,
    previousOpenRuns: 0,
    previousWindowHasRuns: false,
    durationObservationCounts: null,
  },
  continuation: null,
  evidence: { periodPath: periodReadEvidencePath(input) },
  omissions: [],
})

it("adds a period method on the same bounded, cookie-free self-host transport", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ ...response(), additive: true }),
  )
  vi.stubGlobal("fetch", fetch)
  const client = createFlowmarkReadClient({
    apiBaseUrl: "https://self.example/api/",
    readKey: "fm_read_synthetic",
  })
  expect((await client.readPeriod(input)).report.current.totalRuns).toBe(0)
  expect(fetch).toHaveBeenCalledWith(
    "https://self.example/api/v1/read/period",
    expect.objectContaining({ redirect: "error", credentials: "omit" }),
  )
})

it.each([
  { ...response(), selection: { ...input, workflow: "foreign" } },
  {
    ...response(),
    report: {
      ...response().report,
      current: {
        ...response().report.current,
        startedAfter: input.previousStartedAfter,
      },
    },
  },
  { ...response(), coverage: { ...response().coverage, currentOpenRuns: 2 } },
  { ...response(), continuation: "arbitrary" },
  { ...response(), mode: "business" },
  { ...response(), evidence: { periodPath: "https://untrusted.example" } },
])("rejects a widened, malformed or mismatched report", async (body) => {
  vi.stubGlobal("fetch", async () => Response.json(body))
  await expect(
    createFlowmarkReadClient({
      apiBaseUrl: "https://self.example",
      readKey: "fm_read_synthetic",
    }).readPeriod(input),
  ).rejects.toMatchObject({ code: "INVALID_RESPONSE" })
})

it("cancels a stalled period response after the whole client deadline", async () => {
  vi.useFakeTimers()
  const cancel = vi.fn()
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(new ReadableStream({ cancel }), {
        headers: { "Content-Type": "application/json" },
      }),
  )
  const client = createFlowmarkReadClient({
    apiBaseUrl: "https://self.example",
    readKey: "fm_read_synthetic",
  })
  const failure = expect(client.readPeriod(input)).rejects.toMatchObject({
    code: "READ_TIMEOUT",
    status: 200,
  })
  await vi.advanceTimersByTimeAsync(15001)
  await failure
  expect(cancel).toHaveBeenCalled()
})
