import { afterEach, expect, it, vi } from "vitest"
const proxy = vi.hoisted(() => vi.fn())
vi.mock("../features/platform/api-proxy", () => ({ proxyToApiHandler: proxy }))
import { OPTIONS, POST } from "../app/api/waitlist/route"
afterEach(() => proxy.mockReset())
it("allows credential-free landing submissions without touching authentication", async () => {
  const preflight = OPTIONS()
  expect(preflight.status).toBe(204)
  expect(preflight.headers.get("access-control-allow-origin")).toBe("*")
  expect(preflight.headers.has("access-control-allow-credentials")).toBe(false)
  proxy.mockResolvedValue(Response.json({ ok: true }))
  const request = new Request("http://localhost/api/waitlist", {
    method: "POST",
  })
  const response = await POST(request)
  expect(proxy).toHaveBeenCalledWith(request, "/api/waitlist")
  expect(response.headers.get("access-control-allow-origin")).toBe("*")
  expect(await response.json()).toEqual({ ok: true })
})
it("keeps rate-limit errors readable across origins", async () => {
  proxy.mockResolvedValue(
    Response.json(
      { error: "Try again" },
      { status: 429, headers: { "retry-after": "10" } },
    ),
  )
  const response = await POST(
    new Request("http://localhost/api/waitlist", { method: "POST" }),
  )
  expect(response.status).toBe(429)
  expect(response.headers.get("retry-after")).toBe("10")
  expect(response.headers.get("access-control-allow-origin")).toBe("*")
})
