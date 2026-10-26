import { expect, it } from "vitest"
import { flowmarkAgentPrompt } from "../app/agent-prompt"

const prompt = flowmarkAgentPrompt("https://api.flowmark.dev")

it("tells an agent how to install, configure, and choose a process", () => {
  expect(prompt).toContain("@flowmarkdev/node")
  expect(prompt).toContain("@flowmarkdev/node/next")
  expect(prompt).toContain("npm i @flowmarkdev/node")
  expect(prompt).toContain("FLOWMARK_API_URL=https://api.flowmark.dev")
  expect(prompt).toContain("createFlowmark()")
  expect(prompt).toContain("ordinary create, read, update, and delete")
  expect(prompt).toContain("does not execute, schedule, or retry")
})

it("keeps the write key out of the prompt", () => {
  expect(prompt).toContain("Never use NEXT_PUBLIC_, commit, print, or chat-paste the write key.")
  expect(prompt).not.toMatch(/fm_[A-Za-z0-9]+/)
  expect(prompt).not.toContain("NEXT_PUBLIC_FLOWMARK_API_KEY")
})

it("keeps execution identity and privacy rules explicit", () => {
  expect(prompt).toContain("fresh execution ID")
  expect(prompt).toContain("Do not use a durable entity ID")
  expect(prompt).toContain("raw exceptions")
  expect(prompt).toContain("Choose exactly one real process")
})
