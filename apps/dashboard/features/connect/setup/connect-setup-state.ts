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
  readonly hasRuns: boolean
  readonly transient: ConnectSetupTransient
}

export type ConnectSetupStage = {
  readonly id: "instructions" | "configuration" | "evidence"
  readonly label: string
  readonly detail: string
  readonly complete: boolean
}

export function connectSetupStages(
  progress: ConnectSetupProgress,
): readonly ConnectSetupStage[] {
  const instructionsCopied =
    progress.transient.agentCopied || progress.transient.manualCopied
  return [
    {
      id: "instructions",
      label: instructionsCopied ? "Instructions copied" : "Copy instructions",
      detail: instructionsCopied
        ? "Instructions copied. Follow them in your application, then run the process to verify instrumentation."
        : "Choose Cursor or manual SDK setup below.",
      complete: instructionsCopied,
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
    },
    {
      id: "evidence",
      label: progress.hasRuns ? "Evidence observed" : "Awaiting first evidence",
      detail: progress.hasRuns
        ? "This project has recorded runs. Open Runs to inspect timeline and reported outcomes."
        : "Run your process in the application, then open Explore. A saved key alone does not prove telemetry is arriving.",
      complete: progress.hasRuns,
    },
  ]
}
