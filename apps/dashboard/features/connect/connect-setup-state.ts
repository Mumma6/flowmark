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
        ? "Copied locally in this browser. That is not a connection, authorization, or proof of instrumentation."
        : "Choose the coding-agent or manual path below and copy the instructions you need.",
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
        : "Copying instructions or creating a key does not prove telemetry. Run your process and return when evidence arrives.",
      complete: progress.hasRuns,
    },
  ]
}
