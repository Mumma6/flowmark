import { expect, it, vi } from "vitest"
import { Effect } from "effect"
import { readMcpRequest } from "../src/http/request-body.js"
import { mcpResultFits, mcpToolResult } from "../src/tools/response.js"
import { readPagedTool } from "../src/tools/paged-read.js"

it("counts UTF-8 bytes of both text and structured response representations", () => {
  expect(mcpResultFits({ text: "é".repeat(20_000) })).toBe(false)
  expect(mcpResultFits({ text: "a".repeat(20_000) })).toBe(true)
  expect("isError" in mcpToolResult({ text: "é".repeat(20_000) })).toBe(true)
})
it("bounds a chunked request even when the declared content length is false", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(40_000))
      controller.enqueue(new Uint8Array(40_000))
      controller.close()
    },
  })
  const request = new Request("http://localhost/mcp", {
    method: "POST",
    headers: { "content-length": "1" },
    body: stream,
    duplex: "half",
  } as RequestInit)
  const error = await Effect.runPromise(
    readMcpRequest(request).pipe(Effect.flip),
  )
  expect(error.status).toBe(413)
})
it("gets a smaller real page and its matching continuation instead of truncating the old page", async () => {
  const limits: number[] = []
  const read = (value: unknown) => {
    const limit = (value as { limit: number }).limit
    limits.push(limit)
    return Effect.succeed({
      data: "é".repeat(limit * 1000),
      nextCursor: String(limit),
    })
  }
  const page = await Effect.runPromise(readPagedTool({ limit: 20 }, read))
  expect(limits).toEqual([20, 10])
  expect(page.nextCursor).toBe("10")
})
it("never increases an explicitly requested one-record page", async () => {
  let calls = 0
  const error = await Effect.runPromise(
    readPagedTool({ limit: 1 }, () => {
      calls++
      return Effect.succeed({ data: "x".repeat(100_000) })
    }).pipe(Effect.flip),
  )
  expect("reason" in error && error.reason).toContain("One evidence record")
  expect(calls).toBe(1)
})

it("cancels the incoming body reader when its request is interrupted", async () => {
  const cancel = vi.fn()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("{"))
    },
    cancel,
  })
  const controller = new AbortController()
  const request = new Request("http://localhost/mcp", {
    method: "POST",
    body: stream,
    signal: controller.signal,
    duplex: "half",
  } as RequestInit)
  const reading = Effect.runPromise(readMcpRequest(request), {
    signal: controller.signal,
  })
  await vi.waitFor(() => expect(request.body?.locked).toBe(true))
  const rejected = expect(reading).rejects.toBeDefined()
  controller.abort()
  await rejected
  expect(cancel).toHaveBeenCalledOnce()
})
