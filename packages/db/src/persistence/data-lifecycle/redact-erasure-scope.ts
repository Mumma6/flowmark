import { Match } from "effect"
import type { ErasureScope } from "./types.js"

/** Retain only operation kind for terminal UX; no workflow names or selection. */
export const redactErasureScope = (scope: ErasureScope): ErasureScope =>
  Match.value(scope).pipe(
    Match.when({ kind: "runs" }, () => ({ kind: "runs" as const, runIds: [] })),
    Match.when({ kind: "workflow" }, () => ({
      kind: "workflow" as const,
      workflow: "",
      after: "",
      before: "",
    })),
    Match.when({ kind: "project" }, () => ({ kind: "project" as const })),
    Match.exhaustive,
  )
