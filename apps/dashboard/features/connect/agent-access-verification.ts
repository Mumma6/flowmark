import { Array as EffectArray, Match } from "effect"

export type AgentGrantObservation = {
  readonly projectIds: readonly string[]
  readonly lastAuthenticatedAt: string | null
}

export type AgentReadVerification =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Copied" }
  | { readonly _tag: "CopyFailed" }
  | { readonly _tag: "Granted" }
  | {
      readonly _tag: "Verified"
      readonly runs: "unknown" | "none" | "present"
    }
  | { readonly _tag: "Denied" }
  | { readonly _tag: "WrongProject" }
  | { readonly _tag: "UnsupportedClient" }
  | { readonly _tag: "Unavailable" }
  | { readonly _tag: "Disabled" }

const sameProject = (left: string, right: string) =>
  left.toLowerCase() === right.toLowerCase()

const grantsForProject = (
  grants: readonly AgentGrantObservation[],
  projectId: string,
) =>
  EffectArray.filter(grants, (grant) =>
    EffectArray.some(grant.projectIds, (id) => sameProject(id, projectId)),
  )

/**
 * Copied text and a stored grant never become "access verified".
 * Verification requires a recorded delegated read for this project.
 */
export const interpretAgentReadVerification = (input: {
  readonly deployment: "disabled" | "enabled" | "unavailable"
  readonly clientSupported: boolean
  readonly configurationCopied: boolean
  readonly copyFailed: boolean
  readonly connections: "pending" | "unavailable" | "ready"
  readonly grants: readonly AgentGrantObservation[]
  readonly projectId: string | undefined
  readonly runs:
    "unknown" | "empty" | "present" | "unauthorized" | "unavailable"
}): AgentReadVerification =>
  Match.value(input).pipe(
    Match.when({ clientSupported: false }, () => ({
      _tag: "UnsupportedClient" as const,
    })),
    Match.when({ deployment: "unavailable" }, () => ({
      _tag: "Unavailable" as const,
    })),
    Match.when({ deployment: "disabled" }, () => ({
      _tag: "Disabled" as const,
    })),
    Match.when({ connections: "unavailable" }, () => ({
      _tag: "Unavailable" as const,
    })),
    Match.when({ runs: "unauthorized" }, () => ({ _tag: "Denied" as const })),
    Match.when({ runs: "unavailable" }, () => ({
      _tag: "Unavailable" as const,
    })),
    Match.orElse((value) => {
      if (!value.projectId || value.connections !== "ready") {
        return value.copyFailed
          ? { _tag: "CopyFailed" as const }
          : value.configurationCopied
            ? { _tag: "Copied" as const }
            : { _tag: "Idle" as const }
      }
      const matching = grantsForProject(value.grants, value.projectId)
      if (matching.length === 0) {
        return { _tag: "WrongProject" as const }
      }
      const authenticated = EffectArray.some(
        matching,
        (grant) => grant.lastAuthenticatedAt !== null,
      )
      if (!authenticated) {
        return { _tag: "Granted" as const }
      }
      return {
        _tag: "Verified" as const,
        runs: Match.value(value.runs).pipe(
          Match.when("empty", () => "none" as const),
          Match.when("present", () => "present" as const),
          Match.orElse(() => "unknown" as const),
        ),
      }
    }),
  )
