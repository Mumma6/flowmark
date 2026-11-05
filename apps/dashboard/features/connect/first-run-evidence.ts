import { runStatusLabel, type RunStatus } from "../runs/run-presentation"

export type FirstRunRecord = {
  readonly id: string
  readonly workflow: string
  readonly status: RunStatus
  readonly outcome?: string | null
}

export type FirstRunVerification =
  | { readonly kind: "awaiting" }
  | { readonly kind: "verified"; readonly run: FirstRunRecord }
  | { readonly kind: "unavailable" }

export function verifyFirstRunEvidence(
  runs: ReadonlyArray<FirstRunRecord> | undefined,
  unavailable: boolean,
): FirstRunVerification {
  if (unavailable) {
    return { kind: "unavailable" }
  }
  const run = runs?.[0]
  if (!run) {
    return { kind: "awaiting" }
  }
  return { kind: "verified", run }
}

export function firstRunPath(runId: string): string {
  return `/runs/${runId}`
}

export function firstRunEvidenceSummary(run: FirstRunRecord): string {
  const status = runStatusLabel(run.status)
  const outcome =
    run.outcome === undefined || run.outcome === null || run.outcome === ""
      ? "Unreported"
      : run.outcome
  if (run.status === "Running") {
    return `${run.workflow} · ${status}. Missing terminal evidence is unknown — not proof the work is still active or failed.`
  }
  return `${run.workflow} · ${status}. Reported outcome: ${outcome}.`
}

export function awaitingFirstRunDetail(): string {
  return "Copying instructions or creating a key does not prove telemetry. Run your process and return when the API records an execution for this project."
}

export function unavailableFirstRunDetail(): string {
  return "Could not verify recorded evidence for the selected project. Retry after confirming the API is reachable and your project selection is correct."
}
