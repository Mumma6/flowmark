import { expect, it } from "vitest"
import {
  connectSetupStages,
  markSetupCopied,
} from "../features/connect/connect-setup-state"
import {
  verifyFirstRunEvidence,
  firstRunEvidenceSummary,
} from "../features/connect/first-run-evidence"
import {
  instrumentationGuideUrl,
  serverEnvironmentSnippet,
  setupRecoveryCopy,
} from "../features/connect/setup-instructions"

it("keeps copied, configured, and observed setup stages separate", () => {
  const copiedOnly = connectSetupStages({
    hasWriteKey: false,
    verification: { kind: "awaiting" },
    transient: markSetupCopied(
      { agentCopied: false, manualCopied: false },
      "agent",
    ),
  })
  expect(copiedOnly[0]?.complete).toBe(true)
  expect(copiedOnly[1]?.complete).toBe(false)
  expect(copiedOnly[2]?.complete).toBe(false)
  expect(copiedOnly[0]?.detail).toContain("not a connection")

  const verified = connectSetupStages({
    hasWriteKey: true,
    verification: verifyFirstRunEvidence(
      [
        {
          id: "run-1",
          workflow: "imports.daily",
          status: "Completed",
          outcome: "ok",
        },
      ],
      false,
    ),
    transient: { agentCopied: false, manualCopied: false },
  })
  expect(verified[2]?.complete).toBe(true)
  expect(verified[2]?.runId).toBe("run-1")
  expect(verified[2]?.detail).toContain("imports.daily")
})

it("treats missing terminal evidence as unknown in summaries", () => {
  const summary = firstRunEvidenceSummary({
    id: "run-1",
    workflow: "checkout",
    status: "Running",
  })
  expect(summary).toContain("No final outcome")
  expect(summary).toContain("unknown")
  expect(summary).not.toContain("connected")
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
