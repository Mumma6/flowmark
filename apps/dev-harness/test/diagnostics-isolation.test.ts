import { beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  nodeClient: { workflow: vi.fn(), flush: vi.fn(), shutdown: vi.fn() },
  nextClient: { workflow: vi.fn() },
  createNode: vi.fn(),
  createNext: vi.fn(),
  run: vi.fn(),
}))
vi.mock("@flowmarkdev/node", () => ({ createFlowmark: mocks.createNode }))
vi.mock("@flowmarkdev/node/next", () => ({ createFlowmark: mocks.createNext }))
vi.mock("../lib/sdk-scenarios", () => ({
  scenarioIds: ["lifecycle"],
  runScenario: mocks.run,
}))
import { POST } from "../app/api/sdk-tests/route"
import browserConfig from "../flowmark.config"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createNode.mockReturnValue(mocks.nodeClient)
  mocks.createNext.mockReturnValue(mocks.nextClient)
  mocks.run.mockResolvedValue({ runs: [], correlationId: "test-correlation" })
})

it("uses the isolated project's public browser key", () => {
  expect(browserConfig.publicKey).toBe("fm_diagnostics_browser_local_only")
  expect(browserConfig.apiUrl).toBe("http://localhost:3003")
})

it.each(["node", "next"])(
  "routes %s SDK diagnostics to the isolated project, never the application's default key",
  async (runtime) => {
    const response = await POST(
      new Request("http://localhost/api/sdk-tests", {
        method: "POST",
        body: JSON.stringify({ scenario: "lifecycle", runtime }),
      }),
    )
    expect(response.status).toBe(200)
    const create = runtime === "node" ? mocks.createNode : mocks.createNext
    expect(create).toHaveBeenCalledExactlyOnceWith({
      apiKey: "fm_diagnostics_write_local_only",
    })
    expect(mocks.run).toHaveBeenCalledExactlyOnceWith(
      runtime === "node" ? mocks.nodeClient : mocks.nextClient,
      "lifecycle",
      runtime,
    )
    if (runtime === "node") {
      expect(mocks.nodeClient.flush).toHaveBeenCalledOnce()
      expect(mocks.nodeClient.shutdown).toHaveBeenCalledOnce()
    }
  },
)
