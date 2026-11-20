import { expect, it } from "vitest"
import { flowmarkAgentPrompt } from "../features/onboarding/agent-prompt"

const prompt = flowmarkAgentPrompt("https://api.flowmark.dev")

it("tells the agent to fetch the API guide for this origin", () => {
  expect(prompt).toContain("https://api.flowmark.dev/v1/instrumentation")
  expect(prompt).not.toContain("/v1/events")
  expect(prompt).not.toMatch(/Cursor|Claude/)
  expect(prompt).not.toContain("defineWorkflow")
  expect(prompt).not.toContain("FLOWMARK_API_URL=")
  expect(prompt).toContain(
    "Never read, print, commit or request the key in chat",
  )
  expect(prompt).not.toMatch(/fm_[A-Za-z0-9]+/)
})

it("keeps the local API origin on the fetched URL", () => {
  expect(flowmarkAgentPrompt("http://127.0.0.1:3003")).toContain(
    "http://127.0.0.1:3003/v1/instrumentation",
  )
})

it("asks for a shortlist and review before making the first change", () => {
  const scoped = flowmarkAgentPrompt("https://staging.example.test", {
    id: "project-id",
    name: "Billing",
  })
  expect(scoped).toContain("project ID: project-id")
  expect(scoped).toContain("existing instrumentation")
  expect(scoped).toContain("Shortlist two or three processes")
  expect(scoped).toContain("Show the first patch and its collected fields")
  expect(scoped).toContain("Wait for my approval")
  expect(scoped).toContain(
    "what you tested, what arrived and what you read back",
  )
  expect(scoped).toContain("Use Studio if project-approved MCP is unavailable")
  expect(scoped).toContain("https://staging.example.test/v1/instrumentation")
  expect(scoped).not.toContain("@flowmarkdev/node")
  expect(scoped).not.toContain("https://api.flowmark.dev")
})
