import type { FirstRunVerification } from "./first-run-evidence"
import {
  awaitingFirstRunDetail,
  firstRunEvidenceSummary,
  unavailableFirstRunDetail,
} from "./first-run-evidence"

export type SetupPath = "agent" | "manual"

export type ConnectSetupTransient = {
  readonly agentCopied: boolean
  readonly manualCopied: boolean
}

export function initialConnectSetupTransient(): ConnectSetupTransient {
  return { agentCopied: false, manualCopied: false }
}

export function markSetupCopied(
  state: ConnectSetupTransient,
  path: SetupPath,
): ConnectSetupTransient {
  return path === "agent"
    ? { ...state, agentCopied: true }
    : { ...state, manualCopied: true }
}

export function clearConnectSetupTransient(): ConnectSetupTransient {
  return initialConnectSetupTransient()
}

export type ConnectSetupProgress = {
  readonly hasWriteKey: boolean
  readonly verification: FirstRunVerification
  readonly transient: ConnectSetupTransient
}

export type ConnectSetupStage = {
  readonly id: "instructions" | "configuration" | "evidence"
  readonly label: string
  readonly detail: string
  readonly complete: boolean
  readonly runId: string | null
}

export function connectSetupStages(
  progress: ConnectSetupProgress,
): readonly ConnectSetupStage[] {
  const instructionsCopied =
    progress.transient.agentCopied || progress.transient.manualCopied
  const evidenceVerified = progress.verification.kind === "verified"
  const evidenceRunId =
    progress.verification.kind === "verified"
      ? progress.verification.run.id
      : null
  const evidenceDetail =
    progress.verification.kind === "verified"
      ? firstRunEvidenceSummary(progress.verification.run)
      : progress.verification.kind === "unavailable"
        ? unavailableFirstRunDetail()
        : awaitingFirstRunDetail()

  return [
    {
      id: "instructions",
      label: instructionsCopied ? "Instructions copied" : "Copy instructions",
      detail: instructionsCopied
        ? "Copied locally in this browser. That is not a connection, authorization, or proof of instrumentation."
        : "Choose the coding-agent or manual path below and copy the instructions you need.",
      complete: instructionsCopied,
      runId: null,
    },
    {
      id: "configuration",
      label: progress.hasWriteKey
        ? "Write key exists for this project"
        : "Configure the write key",
      detail: progress.hasWriteKey
        ? "Put the key in your server environment with the API origin shown below. Studio sign-in is separate."
        : "Create or recover a server write key in Settings before your application can authenticate.",
      complete: progress.hasWriteKey,
      runId: null,
    },
    {
      id: "evidence",
      label: evidenceVerified
        ? "Evidence observed"
        : progress.verification.kind === "unavailable"
          ? "Evidence unavailable"
          : "Awaiting first evidence",
      detail: evidenceDetail,
      complete: evidenceVerified,
      runId: evidenceRunId,
    },
  ]
}
