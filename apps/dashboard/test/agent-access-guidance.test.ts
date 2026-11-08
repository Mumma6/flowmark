import { expect, it } from "vitest"
import {
  agentClientGuides,
  agentExampleQuestions,
  manualEvidenceHandoffIntro,
} from "../features/connect/agent-access-guidance"

it("covers four manual client paths without ingestion secrets", () => {
  const guides = agentClientGuides()
  expect(guides.map((guide) => guide.id)).toEqual([
    "codex",
    "cursor",
    "claude-code",
    "custom",
  ])
  for (const guide of guides) {
    expect(guide.steps.length).toBeGreaterThan(0)
    const blob = [guide.summary, ...guide.steps, guide.pasteHint].join("\n")
    expect(blob).not.toContain("FLOWMARK_API_KEY")
    expect(blob).not.toMatch(/fm_[a-z0-9]+/i)
  }
})

it("builds example questions and handoff copy for the active project", () => {
  const questions = agentExampleQuestions("Billing")
  expect(questions).toHaveLength(3)
  expect(questions[0]?.prompt).toContain("Billing")
  const handoff = manualEvidenceHandoffIntro(
    "Billing",
    "https://studio.example.test",
  )
  expect(handoff).toContain("Billing")
  expect(handoff).toContain("https://studio.example.test/explore")
  expect(handoff).not.toContain("FLOWMARK_API_KEY")
})

it("gives an enabled deployment its endpoint without writing client files", () => {
  const guides = agentClientGuides("https://api.example.test/mcp")
  expect(guides).toHaveLength(4)
  for (const guide of guides) {
    const blob = [guide.summary, ...guide.steps, guide.pasteHint].join("\n")
    expect(blob).toContain("https://api.example.test/mcp")
    expect(blob).toContain("does not write")
    expect(blob).not.toContain("FLOWMARK_API_KEY")
  }
})
