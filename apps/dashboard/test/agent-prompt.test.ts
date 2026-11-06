import { expect, it } from "vitest"
import { flowmarkAgentPrompt } from "../features/onboarding/agent-prompt"

const prompt = flowmarkAgentPrompt("https://api.flowmark.dev")

it("tells the agent to fetch the API guide for this origin", () => {
  expect(prompt).toContain(
    "Fetch and follow https://api.flowmark.dev/v1/instrumentation",
  )
  expect(prompt).not.toContain("/v1/events")
  expect(prompt).toContain("does not connect an agent")
  expect(prompt).not.toContain("defineWorkflow")
  expect(prompt).not.toContain("FLOWMARK_API_KEY")
  expect(prompt).not.toMatch(/fm_[A-Za-z0-9]+/)
})

it("keeps the local API origin on the fetched URL", () => {
  expect(flowmarkAgentPrompt("http://127.0.0.1:3003")).toContain(
    "Fetch and follow http://127.0.0.1:3003/v1/instrumentation",
  )
})
