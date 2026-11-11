import { expect, it } from "vitest"
import {
  connectSetupStages,
  markSetupCopied,
} from "../features/connect/setup/connect-setup-state"
import {
  instrumentationGuideUrl,
  serverEnvironmentSnippet,
  setupRecoveryCopy,
} from "../features/connect/setup/setup-instructions"

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
  expect(copiedOnly[0]?.detail).toContain("not a connection")

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
  expect(serverEnvironmentSnippet(origin)).toBe(
    "FLOWMARK_API_KEY=<write key>\nFLOWMARK_API_URL=https://api.flowmark.dev",
  )
  expect(instrumentationGuideUrl(origin)).toBe(
    "https://api.flowmark.dev/v1/instrumentation",
  )
  const recovery = setupRecoveryCopy(origin, "Production app")
  expect(recovery.lostKey).toContain("Settings")
  expect(recovery.wrongProject).toContain("Production app")
  expect(recovery.wrongOrigin).toContain(origin)
  expect(recovery.copyFailure).toContain("clipboard")
})
