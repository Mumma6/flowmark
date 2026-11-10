import { Effect, Layer } from "effect"
import { ReadPublicRun, PublicReadFailure } from "@flowmark/api"
import { afterEach, expect, it, vi } from "vitest"
import { handlePublicRunRead } from "../../src/adapters/public-run-read"

afterEach(() => vi.useRealTimers())
const input = {
  version: 1,
  kind: "run",
  section: "events",
  projectId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
}
const request = (
  body: string = JSON.stringify(input),
  headers: HeadersInit = { "Content-Type": "application/json" },
) =>
  new Request("http://localhost/v1/read/run", { method: "POST", headers, body })

it("maps admission errors safely, preserves retry guidance and prevents caching", async () => {
  const layer = Layer.succeed(ReadPublicRun, {
    read: () =>
      Effect.fail(
        new PublicReadFailure({ code: "RATE_LIMITED", retryAfterSeconds: 9 }),
      ),
  })
  const response = await handlePublicRunRead(request(), layer)
  expect(response.status).toBe(429)
  expect(response.headers.get("Retry-After")).toBe("9")
  expect(response.headers.get("Cache-Control")).toBe("no-store")
  expect((await response.json()).error.code).toBe("RATE_LIMITED")
})

it("rejects wrong media, malformed JSON, excessive streamed bytes and methods before application reads", async () => {
  const read = vi.fn(() => Effect.die("Unexpected application read"))
  const layer = Layer.succeed(ReadPublicRun, { read })
  expect(
    (
      await handlePublicRunRead(
        request("{}", { "Content-Type": "text/plain" }),
        layer,
      )
    ).status,
  ).toBe(415)
  expect((await handlePublicRunRead(request("{"), layer)).status).toBe(400)
  expect(
    (await handlePublicRunRead(request(" ".repeat(8193)), layer)).status,
  ).toBe(413)
  const method = await handlePublicRunRead(
    new Request("http://localhost/v1/read/run"),
    layer,
  )
  expect(method.status).toBe(405)
  expect(method.headers.get("Allow")).toBe("POST")
  expect(read).not.toHaveBeenCalled()
})

it("bounds the whole request lifetime and interrupts the application scope", async () => {
  vi.useFakeTimers()
  const interrupted = vi.fn()
  const layer = Layer.succeed(ReadPublicRun, {
    read: () => Effect.never.pipe(Effect.ensuring(Effect.sync(interrupted))),
  })
  const response = handlePublicRunRead(request(), layer)
  await vi.advanceTimersByTimeAsync(15001)
  expect((await response).status).toBe(504)
  expect(interrupted).toHaveBeenCalled()
})

it("fails explicitly when serialized evidence exceeds the server response budget", async () => {
  const selection = {
    ...input,
    version: 1 as const,
    kind: "run" as const,
    section: "events" as const,
    limit: 50,
  }
  const layer = Layer.succeed(ReadPublicRun, {
    read: () =>
      Effect.succeed({
        version: 1 as const,
        selection,
        observedAt: "2026-11-10T00:00:00.000Z",
        summary: {
          id: input.runId,
          workflow: "x".repeat(65536),
          status: "Running" as const,
          startedAt: "2026-11-10T00:00:00.000Z",
          durationMs: null,
          eventCount: 0,
        },
        page: { events: [], limit: 50, totalEvents: 0, nextCursor: null },
        evidence: { runPath: `/runs/${input.runId}` },
        omissions: [],
      }),
  })
  const response = await handlePublicRunRead(request(), layer)
  expect(response.status).toBe(422)
  expect((await response.json()).error.code).toBe("EVIDENCE_TOO_LARGE")
})

it("hides storage diagnostics behind an unavailable response", async () => {
  const layer = Layer.succeed(ReadPublicRun, {
    read: () =>
      Effect.fail(
        new PublicReadFailure({
          code: "READ_UNAVAILABLE",
          cause: new Error("PRIVATE_DRIVER_DETAILS"),
        }),
      ),
  })
  const response = await handlePublicRunRead(request(), layer)
  expect(response.status).toBe(503)
  expect(await response.text()).not.toContain("PRIVATE_DRIVER_DETAILS")
})
