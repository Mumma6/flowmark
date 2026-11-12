import { afterEach, expect, it, vi } from "vitest"
import {
  createFlowmarkReadClient,
  FlowmarkReadError,
} from "../src/reads/index.js"
import { runReadEvidencePath } from "@flowmarkdev/core"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
const input = {
  version: 1,
  kind: "run",
  section: "events",
  projectId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
} as const
const response = () => ({
  version: 1,
  selection: { ...input, limit: 50 },
  observedAt: "2026-11-10T00:00:00.000Z",
  summary: {
    id: input.runId,
    workflow: "test",
    status: "Running",
    startedAt: "2026-11-10T00:00:00.000Z",
    durationMs: null,
    eventCount: 0,
  },
  page: { events: [], limit: 50, totalEvents: 0, nextCursor: null },
  evidence: { runPath: runReadEvidencePath({ ...input, limit: 50 }) },
  omissions: ["event_payloads", "business_results"],
})

it("preserves self-host base paths, omits cookies/redirects, validates empty success and ignores additive fields", async () => {
  const fetch = vi.fn(async () =>
    Response.json({ ...response(), future: true }),
  )
  vi.stubGlobal("fetch", fetch)
  const client = createFlowmarkReadClient({
    apiBaseUrl: "https://self.example/flowmark/",
    readKey: "fm_read_synthetic",
  })
  expect((await client.readRun(input)).page.events).toEqual([])
  expect(fetch).toHaveBeenCalledWith(
    "https://self.example/flowmark/v1/read/run",
    expect.objectContaining({
      method: "POST",
      credentials: "omit",
      redirect: "error",
    }),
  )
})

it.each([
  "http://remote.example",
  "https://user:secret@self.example",
  "https://self.example?key=x",
  "https://self.example#fragment",
])("rejects unsafe base %s without exposing its value", (apiBaseUrl) => {
  expect(() =>
    createFlowmarkReadClient({ apiBaseUrl, readKey: "fm_read_synthetic" }),
  ).toThrow(FlowmarkReadError)
})

it("preserves future server error codes and retry delays without echoing the body or key", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json(
      {
        version: 1,
        error: {
          code: "FUTURE_LIMIT",
          message: "sensitive upstream details",
          retryAfterSeconds: 8,
        },
      },
      { status: 429 },
    ),
  )
  const client = createFlowmarkReadClient({
    apiBaseUrl: "http://127.0.0.1",
    readKey: "fm_read_secret",
  })
  await expect(client.readRun(input)).rejects.toMatchObject({
    code: "FUTURE_LIMIT",
    status: 429,
    retryAfterSeconds: 8,
    message: "Flowmark read failed: FUTURE_LIMIT.",
  })
})

it.each([
  { ...response(), summary: { ...response().summary, status: "Unknown" } },
  {
    ...response(),
    selection: {
      ...input,
      limit: 50,
      projectId: "00000000-0000-4000-8000-000000000009",
    },
  },
  { ...response(), evidence: { runPath: "https://untrusted.example" } },
  { ...response(), page: { ...response().page, limit: 2 } },
])(
  "rejects malformed, mismatched and unsafe success responses",
  async (body) => {
    vi.stubGlobal("fetch", async () => Response.json(body))
    const client = createFlowmarkReadClient({
      apiBaseUrl: "https://self.example",
      readKey: "fm_read_synthetic",
    })
    await expect(client.readRun(input)).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    })
  },
)

it("bounds streamed response bytes without Content-Length and cancels the reader", async () => {
  const cancel = vi.fn()
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(65537))
          },
          cancel,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  )
  const client = createFlowmarkReadClient({
    apiBaseUrl: "https://self.example",
    readKey: "fm_read_synthetic",
  })
  await expect(client.readRun(input)).rejects.toMatchObject({
    code: "INVALID_RESPONSE",
  })
  expect(cancel).toHaveBeenCalled()
})

it("cancels response-body consumption when the caller aborts", async () => {
  const cancel = vi.fn()
  const controller = new AbortController()
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start() {
            setTimeout(() => controller.abort(), 10)
          },
          cancel,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  )
  const client = createFlowmarkReadClient({
    apiBaseUrl: "https://self.example",
    readKey: "fm_read_synthetic",
  })
  await expect(
    client.readRun(input, { signal: controller.signal }),
  ).rejects.toMatchObject({ code: "ABORTED" })
  expect(cancel).toHaveBeenCalled()
})

it("keeps the deadline active after headers and cancels a stalled body", async () => {
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
  const failure = expect(client.readRun(input)).rejects.toMatchObject({
    code: "READ_TIMEOUT",
    status: 200,
  })
  await vi.advanceTimersByTimeAsync(15001)
  await failure
  expect(cancel).toHaveBeenCalled()
})
