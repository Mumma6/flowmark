import { expect, it } from "vitest"
import { GET } from "../../app/v1/instrumentation/route"

const guide = async (url: string) => {
  const response = GET(new Request(url))
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe(
    "text/markdown; charset=utf-8",
  )
  expect(response.headers.get("cache-control")).toBe("no-store")
  return response.text()
}

it("returns the instrumentation guide for the API origin that was fetched", async () => {
  const body = await guide("https://api.flowmark.dev/v1/instrumentation")
  expect(body).toContain("FLOWMARK_API_URL=https://api.flowmark.dev")
  expect(body).not.toContain(
    "FLOWMARK_API_URL=https://api.flowmark.dev/v1/events",
  )
  expect(body).toContain("not a path ending in `/v1/events`")
  expect(body).toContain("defineWorkflow<Context, Result, Outcome>")
  expect(body).toContain("flow.report(snapshot)")
  expect(body).toContain("correlationId")
  expect(body).toContain("parentRunId")
  expect(body).toContain("flow.expect(name, options)")
  expect(body).toContain("expectations-v1")
  expect(body).toContain("attempts-v1")
  expect(body).toContain("Do not call `shutdown()` yourself")
  expect(body).toContain("@flowmarkdev/node/browser")
  expect(body).toContain("does not connect an agent")
  expect(body).toContain("must never change business behavior")
  expect(body).toContain("There is no `track()`, `span()`, or `metric()`.")
  expect(body).not.toMatch(/fm_[A-Za-z0-9]+/)
})

it("uses the request origin instead of a fixed production host", async () => {
  const body = await guide("http://127.0.0.1:3003/v1/instrumentation")
  expect(body).toContain("FLOWMARK_API_URL=http://127.0.0.1:3003")
  expect(body).not.toContain("https://api.flowmark.dev")
})
