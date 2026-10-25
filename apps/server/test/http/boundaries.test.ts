import { Effect, Either } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvalidInput } from "@flowmark/api"
import { readJsonBody } from "../../src/adapters/request-body"
import { POST } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const input = {
  eventId: "00000000-0000-4000-8000-000000000003",
  event: {
    type: "started",
    workflow: "test",
    runId: "test-run",
    timestamp: "2026-10-23T12:00:00.000Z",
  },
}

describe("HTTP boundaries", () => {
  it("decodes JSON using Schema and preserves malformed JSON errors", async () => {
    expect(
      await Effect.runPromise(
        readJsonBody(
          new Request("http://localhost", {
            method: "POST",
            body: JSON.stringify(input),
          }),
        ),
      ),
    ).toEqual(input)
    const result = await Effect.runPromise(
      Effect.either(
        readJsonBody(
          new Request("http://localhost", {
            method: "POST",
            body: "{",
          }),
        ),
      ),
    )
    Either.match(result, {
      onLeft: (error) => expect(error).toMatchObject({ _tag: "InvalidInput" }),
      onRight: () => expect.fail("expected invalid JSON"),
    })
  })

  it("preserves streamed read failures and releases the reader", async () => {
    const cause = new Error("stream failed")
    vi.spyOn(console, "log").mockImplementation(() => {})
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => controller.error(cause),
    })
    const options: RequestInit & { duplex: "half" } = {
      method: "POST",
      body,
      duplex: "half",
    }
    const result = await Effect.runPromise(
      Effect.either(readJsonBody(new Request("http://localhost", options))),
    )
    Either.match(result, {
      onLeft: (error) => expect(error).toEqual(new InvalidInput({ cause })),
      onRight: () => expect.fail("expected a streamed read failure"),
    })
    expect(body.locked).toBe(false)
  })

  it("rejects anonymous tRPC reads", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/flowmark")
    vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    await expect(
      appRouter.createCaller({
        request: new Request("http://localhost"),
      }).project.snapshot(),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Sign in required.",
    })
  })

  it("reports missing storage configuration explicitly for HTTP and tRPC", async () => {
    vi.stubEnv("DATABASE_URL", "")
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(input),
    })
    expect((await POST(request)).status).toBe(503)
    await expect(
      appRouter
        .createCaller({
          request: new Request("http://localhost", {
            headers: { authorization: "Bearer read-key" },
          }),
        })
        .project.snapshot(),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
    })
    expect(log).toHaveBeenCalledTimes(2)
  })
})
