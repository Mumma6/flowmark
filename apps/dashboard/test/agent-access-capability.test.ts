import { expect, it } from "vitest"
import { remoteAgentAccessFromProbe } from "../features/connect/access/agent-access-capability"

it("does not advertise an MCP endpoint when metadata is missing", () => {
  const deployment = remoteAgentAccessFromProbe({
    apiOrigin: "https://api.example.test",
    status: 404,
    resource: null,
  })
  expect(deployment.kind).toBe("unavailable")
  if (deployment.kind === "unavailable") {
    expect(deployment.headline).toContain("could not be confirmed")
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
