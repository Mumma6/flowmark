import { expect, it } from "vitest"
import { flowmarkAgentPrompt } from "../features/onboarding/agent-prompt"
import {
  connectSetupStages,
  markSetupCopied,
} from "../features/connect/setup/connect-setup-state"
import {
  instrumentationGuideUrl,
  manualWorkflowSnippet,
  serverEnvironmentSnippet,
  setupRecoveryCopy,
} from "../features/connect/setup/setup-instructions"

it("gives onboarding agents explicit runtime ownership and business-outcome guidance", () => {
  const prompt = flowmarkAgentPrompt("https://api.flowmark.dev")
  expect(prompt).toContain("https://api.flowmark.dev/v1/instrumentation")
  expect(prompt).toContain(
    "@flowmarkdev/node/next client with automatic delivery",
  )
  expect(prompt).toContain("Standalone scripts and workers create their own")
  expect(prompt).toContain("Shared business logic accepts a Flow")
  expect(prompt).toContain(
    "callback form for a process that finishes in one invocation",
  )
  expect(prompt).toContain("Read linked references")
  expect(prompt).toContain("meaningful business outcome")
  expect(prompt).toContain("partial results")
  expect(prompt).toContain("configuration errors must remain visible")
  expect(prompt).not.toContain("create one shared client")
})

it("keeps copied, configured, and observed setup stages separate", () => {
  const copiedOnly = connectSetupStages({
    hasWriteKey: false,
    hasRuns: false,
    transient: markSetupCopied(
      { agentCopied: false, manualCopied: false },
      "agent",
    ),
  })
  expect(copiedOnly[0]?.complete).toBe(true)
  expect(copiedOnly[1]?.complete).toBe(false)
  expect(copiedOnly[2]?.complete).toBe(false)
  expect(copiedOnly[0]?.detail).toContain("run the process to verify")

  const configured = connectSetupStages({
    hasWriteKey: true,
    hasRuns: false,
    transient: { agentCopied: false, manualCopied: false },
  })
  expect(configured[1]?.complete).toBe(true)
  expect(configured[2]?.detail).toContain("does not prove telemetry")
})

it("builds manual setup snippets and recovery copy for the validated origin", () => {
  const origin = "https://api.flowmark.dev"
  expect(serverEnvironmentSnippet(origin)).toBe("FLOWMARK_API_KEY=<write key>")
  expect(serverEnvironmentSnippet("http://127.0.0.1:3003")).toBe(
    "FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=http://127.0.0.1:3003",
  )
  expect(instrumentationGuideUrl(origin)).toBe(
    "https://api.flowmark.dev/v1/instrumentation",
  )
  const recovery = setupRecoveryCopy(origin, "Production app")
  expect(recovery.lostKey).toContain("Settings")
  expect(recovery.wrongProject).toContain("Production app")
  expect(recovery.wrongOrigin).toContain(origin)
  expect(recovery.copyFailure).toContain("clipboard")
  const snippet = manualWorkflowSnippet(origin)
  expect(snippet).toContain("importBatch(batchId)")
  expect(snippet).toContain("skipped: imported.skipped")
  expect(snippet).toContain("return imported")
  expect(snippet).toContain(
    'outcome: imported.skipped > 0 ? "partial" : "complete"',
  )
  expect(snippet).toContain('workflow("customer.import", async (flow)')
  expect(snippet).not.toContain("throw error")
  expect(snippet).toContain("await flowmark.flush()")
  expect(snippet).not.toContain("shutdown()")
  expect(snippet).not.toContain("npm i")
  expect(snippet).not.toContain("FLOWMARK_API_KEY=")
  expect(snippet).not.toMatch(/fm_[A-Za-z0-9]+/)
})
