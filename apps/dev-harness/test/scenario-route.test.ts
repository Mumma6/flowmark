import { beforeEach, expect, it, vi } from "vitest"

const { run, client } = vi.hoisted(() => ({
  run: vi.fn(),
  client: { workflow: vi.fn() },
}))
vi.mock("../lib/flowmark", () => ({ flowmark: client }))
vi.mock("../lib/business-scenarios", () => ({ runBusinessScenario: run }))
import { POST } from "../app/api/scenarios/route"

beforeEach(() => vi.clearAllMocks())

it("rejects malformed JSON without executing work", async () => {
  const response = await POST(
    new Request("http://localhost/api/scenarios", {
      method: "POST",
      body: "{",
    }),
  )
  expect(response.status).toBe(400)
  expect(run).not.toHaveBeenCalled()
})

it("rejects unknown and technical test scenarios", async () => {
  for (const scenario of ["sdk.node.lifecycle", "", "invoices-unknown"]) {
    const response = await POST(
      new Request("http://localhost/api/scenarios", {
        method: "POST",
        body: JSON.stringify({ scenario }),
      }),
    )
    expect(response.status).toBe(400)
  }
  expect(run).not.toHaveBeenCalled()
})

it("executes a selected application scenario through the configured SDK client", async () => {
  run.mockResolvedValue({ scenario: "inventory-interrupted", status: "failed" })
  const response = await POST(
    new Request("http://localhost/api/scenarios", {
      method: "POST",
      body: JSON.stringify({ scenario: "inventory-interrupted" }),
    }),
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ status: "failed" })
  expect(run).toHaveBeenCalledExactlyOnceWith(client, "inventory-interrupted")
})
