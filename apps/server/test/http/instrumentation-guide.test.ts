import { expect, it } from "vitest"
import { GET } from "../../app/v1/instrumentation/route"

const guide = async (url: string) => {
  const response = GET(new Request(url))
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe(
    "text/markdown; charset=utf-8",
  )
  expect(response.headers.get("cache-control")).toContain("public")
  expect(response.headers.get("cache-control")).toContain("s-maxage=300")
  expect(response.headers.get("cache-control")).not.toContain("no-store")
  return response.text()
}

it("returns the instrumentation guide for the API origin that was fetched", async () => {
  const body = await guide("https://api.flowmark.dev/v1/instrumentation")
  expect(body).not.toContain("FLOWMARK_API_URL=")
  expect(body).not.toContain(
    "FLOWMARK_API_URL=https://api.flowmark.dev/v1/events",
  )
  expect(body).toContain("not a path ending in `/v1/events`")
  expect(body).toContain("npm i @flowmarkdev/node")
  expect(body).toContain(
    'import { createFlowmark } from "@flowmarkdev/node/next"',
  )
  expect(body).toContain('import { createFlowmark } from "@flowmarkdev/node"')
  expect(body).toContain("Do not call `shutdown()` yourself")
  expect(body).toContain('flow.operation("save-invoices"')
  expect(body).toContain(
    'outcome: result.rejected > 0 ? "partial" : "complete"',
  )
  expect(body).toContain("await flowmark.shutdown()")
  expect(body).not.toContain("throw error")
  expect(body).toContain("Configuration errors are deliberate errors")
  expect(body).toContain("no nullable client")
  expect(body).toContain(
    "this guide is sufficient for the first server integration",
  )
  expect(body).toContain('flowmark.workflow("invoice.import", async flow')
  expect(body).not.toMatch(/fm_[A-Za-z0-9]+/)
})

it("redirects query strings to the canonical guide", () => {
  const response = GET(
    new Request("https://api.flowmark.dev/v1/instrumentation?retry=1"),
  )
  expect(response.status).toBe(308)
  expect(response.headers.get("location")).toBe(
    "https://api.flowmark.dev/v1/instrumentation",
  )
  expect(response.headers.get("cache-control")).toContain("s-maxage=300")
})

it("uses the request origin instead of a fixed production host", async () => {
  const body = await guide("http://127.0.0.1:3003/v1/instrumentation")
  expect(body).toContain("FLOWMARK_API_URL=http://127.0.0.1:3003")
  expect(body).not.toContain("FLOWMARK_API_URL=https://api.flowmark.dev")
})
