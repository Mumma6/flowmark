import { Effect, Result } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { InvalidInput } from "@flowmark/api"
import { readJsonBody } from "../../src/adapters/request-body"
import { POST } from "../../app/v1/events/route"
import { GET as health } from "../../app/api/health/route"
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
  it("exposes the deployed revision without caching the health response", async () => {
    const sha = "a".repeat(40)
    vi.stubEnv("FLOWMARK_DEPLOYMENT_SHA", sha)
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "different-build-context")
    const response = health()
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({
      status: "ok",
      service: "flowmark-api",
      commit: sha,
    })
  })

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
      Effect.result(
        readJsonBody(
          new Request("http://localhost", {
            method: "POST",
            body: "{",
          }),
        ),
      ),
    )
    Result.match(result, {
      onFailure: (error) =>
        expect(error).toMatchObject({ _tag: "InvalidInput" }),
      onSuccess: () => expect.fail("expected invalid JSON"),
    })
  })

  it("preserves streamed read failures and releases the reader", async () => {
    const cause = new Error("stream failed")
    vi.spyOn(console, "log").mockImplementation(() => {})
    const body = new ReadableStream<Uint8Array>({
      start: (controller) => controller.error(cause),
    })
    const options: RequestInit & {
      duplex: "half"
    } = {
      method: "POST",
      body,
      duplex: "half",
    }
    const result = await Effect.runPromise(
      Effect.result(readJsonBody(new Request("http://localhost", options))),
    )
    Result.match(result, {
      onFailure: (error) => expect(error).toEqual(new InvalidInput({ cause })),
      onSuccess: () => expect.fail("expected a streamed read failure"),
    })
    expect(body.locked).toBe(false)
  })

  it("rejects anonymous tRPC reads", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/flowmark")
    vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    await expect(
      appRouter
        .createCaller({
          request: new Request("http://localhost"),
        })
        .project.snapshot(),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Sign in required.",
    })
  })

  it("keeps PostgreSQL UUID shapes valid before tRPC authorization", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/flowmark")
    vi.stubEnv("FLOWMARK_DEMO_MODE", "true")
    const caller = appRouter.createCaller({
      request: new Request("http://localhost"),
    })
    await expect(
      caller.project.keys("00000000-0000-9000-0000-000000000000"),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Sign in required.",
    })
    await expect(caller.project.keys("not-a-uuid")).rejects.toMatchObject({
      code: "BAD_REQUEST",
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
