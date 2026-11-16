import { CURSOR_MCP_PUBLIC_CLIENT } from "@flowmark/auth/agent-access"
import { expect, it } from "vitest"
import {
  cursorMcpClientId,
  cursorMcpConfig,
  cursorMcpRedirectUris,
} from "../features/connect/access/cursor-mcp-client"
import {
  agentAccessIntroCopy,
  agentClientGuides,
  agentExampleQuestions,
  manualEvidenceHandoffIntro,
} from "../features/connect/access/agent-access-guidance"

it("keeps the Cursor public client aligned with the auth registration", () => {
  expect(cursorMcpClientId).toBe(CURSOR_MCP_PUBLIC_CLIENT.clientId)
  expect([...cursorMcpRedirectUris]).toEqual([
    ...CURSOR_MCP_PUBLIC_CLIENT.redirectUris,
  ])
  const config = cursorMcpConfig("https://api.example.test/mcp")
  expect(config).toContain(CURSOR_MCP_PUBLIC_CLIENT.clientId)
  expect(config).toContain("offline_access")
  expect(config).toContain("flowmark:read")
  expect(config).not.toContain("CLIENT_SECRET")
})

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
    expect(blob).toContain("could not be confirmed")
    expect(blob).not.toContain("future release")
    expect(blob).not.toContain("FLOWMARK_API_KEY")
    expect(blob).not.toMatch(/fm_[a-z0-9]+/i)
  }
})

it("builds example questions and handoff copy for the active project", () => {
  const questions = agentExampleQuestions("Billing", "unavailable")
  expect(questions).toHaveLength(3)
  expect(questions[0]?.prompt).toContain("Billing")
  expect(questions[0]?.prompt).toContain("could not be confirmed")
  expect(questions[0]?.prompt).not.toContain("get_connection")
  const handoff = manualEvidenceHandoffIntro(
    "Billing",
    "https://studio.example.test",
    "unavailable",
  )
  expect(handoff).toContain("Billing")
  expect(handoff).toContain("https://studio.example.test/")
  expect(handoff).toContain("https://studio.example.test/runs")
  expect(handoff).not.toContain("/explore")
  expect(handoff).toContain("could not be confirmed")
  expect(handoff).not.toContain("FLOWMARK_API_KEY")
  expect(agentAccessIntroCopy("unavailable").body).toContain(
    "could not be confirmed",
  )
  expect(agentAccessIntroCopy("unavailable").separation).not.toContain(
    "future release",
  )
})

it("points an enabled deployment at the read-only MCP tools", () => {
  const questions = agentExampleQuestions("Billing", "enabled")
  const prompt = questions.map((question) => question.prompt).join("\n")
  expect(prompt).toContain("get_connection")
  expect(prompt).toContain("list_workflows")
  expect(prompt).toContain("find_runs")
  expect(prompt).toContain("get_run")
  expect(prompt).toContain("get_workflow_insights")
  expect(prompt).not.toContain("evidence I paste")
  const handoff = manualEvidenceHandoffIntro(
    "Billing",
    "https://studio.example.test",
    "enabled",
  )
  expect(handoff).toContain("available on this deployment")
  expect(handoff).toContain("get_connection")
  expect(handoff).toContain("https://studio.example.test/")
  expect(handoff).not.toContain("/explore")
  expect(handoff).not.toContain("Paste the summary")
  expect(agentAccessIntroCopy("enabled").body).toContain("available")
  expect(agentAccessIntroCopy("unavailable").body).toContain(
    "could not be confirmed",
  )
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
