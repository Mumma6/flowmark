import { expect, it } from "vitest"
import { remoteAgentAccessFromProbe } from "../features/connect/agent-access-capability"

it("reports remote agent access as disabled without advertising an MCP command", () => {
  const deployment = remoteAgentAccessFromProbe({
    apiOrigin: "https://api.example.test",
    status: 404,
    resource: null,
  })
  expect(deployment.kind).toBe("disabled")
  if (deployment.kind === "disabled") {
    expect(deployment.headline).toContain("not enabled")
    expect(JSON.stringify(deployment)).not.toContain("/mcp")
  }
})

it("accepts only the deployment's own MCP resource", () => {
  const enabled = remoteAgentAccessFromProbe({
    apiOrigin: "https://api.example.test",
    status: 200,
    resource: "https://api.example.test/mcp",
  })
  expect(enabled).toEqual({
    kind: "enabled",
    mcpUrl: "https://api.example.test/mcp",
  })
  expect(
    remoteAgentAccessFromProbe({
      apiOrigin: "https://api.example.test",
      status: 200,
      resource: "https://elsewhere.example/mcp",
    }).kind,
  ).toBe("unavailable")
  expect(
    remoteAgentAccessFromProbe({
      apiOrigin: "https://api.example.test",
      status: null,
      resource: null,
    }).kind,
  ).toBe("unavailable")
})
