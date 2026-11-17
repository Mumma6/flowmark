import { expect, it } from "vitest"
import { flowmarkAgentPrompt } from "../features/onboarding/agent-prompt"

const prompt = flowmarkAgentPrompt("https://api.flowmark.dev")

it("tells the agent to fetch the API guide for this origin", () => {
  expect(prompt).toContain(
    "Fetch and follow https://api.flowmark.dev/v1/instrumentation",
  )
  expect(prompt).not.toContain("/v1/events")
  expect(prompt).not.toMatch(/MCP|Cursor|Claude/)
  expect(prompt).not.toContain("defineWorkflow")
  expect(prompt).not.toContain("FLOWMARK_API_URL=")
  expect(prompt).toContain(
    "never read, print, commit or request the key in chat",
  )
  expect(prompt).not.toMatch(/fm_[A-Za-z0-9]+/)
})

it("keeps the local API origin on the fetched URL", () => {
  expect(flowmarkAgentPrompt("http://127.0.0.1:3003")).toContain(
    "Fetch and follow http://127.0.0.1:3003/v1/instrumentation",
  )
})

it("scopes instrumentation and evidence verification to the selected project", () => {
  const scoped = flowmarkAgentPrompt("https://staging.example.test", {
    id: "project-id",
    name: "Billing",
  })
  expect(scoped).toContain("project ID: project-id")
  expect(scoped).toContain("Use that guide for the first integration")
  expect(scoped).toContain("only when a specific question remains")
  expect(scoped).toContain("Preserve return values, original errors")
  expect(scoped).toContain("imported, skipped or rejected counts")
  expect(scoped).toContain("Flowmark Studio")
  expect(scoped).toContain("documented SDK delivery diagnostics")
  expect(scoped).not.toMatch(
    /MCP|get_connection|list_workflows|find_runs|get_run|OAuth/,
  )
  expect(scoped).toContain("FLOWMARK_API_URL=https://staging.example.test")
  expect(scoped).not.toContain("https://api.flowmark.dev")
})
