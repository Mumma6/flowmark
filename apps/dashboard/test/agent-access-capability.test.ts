import { expect, it } from "vitest"
import { remoteAgentAccessDeployment } from "../features/connect/agent-access-capability"

it("reports remote agent access as disabled without advertising an MCP command", () => {
  const deployment = remoteAgentAccessDeployment("https://api.example.test")
  expect(deployment.kind).toBe("disabled")
  if (deployment.kind === "disabled") {
    expect(deployment.headline).toContain("not enabled")
    expect(JSON.stringify(deployment)).not.toContain("/mcp")
  }
})
