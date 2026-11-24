import { Array as EffectArray, Data, Match } from "effect"

export type AgentGrantObservation = {
  readonly projectIds: readonly string[]
  readonly lastAuthenticatedAt: string | null
}

export type AgentReadVerification = Data.TaggedEnum<{
  Idle: Record<never, never>
  Copied: Record<never, never>
  CopyFailed: Record<never, never>
  Granted: Record<never, never>
  Authenticated: Record<never, never>
  Denied: Record<never, never>
  WrongProject: Record<never, never>
  UnsupportedClient: Record<never, never>
  Unavailable: Record<never, never>
}>

export const AgentRead = Data.taggedEnum<AgentReadVerification>()

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
 * The stored timestamp records authentication for a grant family, including
 * get_connection and failed reads. It cannot verify project evidence retrieval.
 */
export const interpretAgentReadVerification = (input: {
  readonly deployment: "enabled" | "unavailable"
  readonly clientSupported: boolean
  readonly configurationCopied: boolean
  readonly copyFailed: boolean
  readonly connections: "pending" | "unauthorized" | "unavailable" | "ready"
  readonly grants: readonly AgentGrantObservation[]
  readonly projectId: string | undefined
}): AgentReadVerification =>
  Match.value(input).pipe(
    Match.when({ clientSupported: false }, () =>
      AgentRead.UnsupportedClient(),
    ),
    Match.when({ deployment: "unavailable" }, () => AgentRead.Unavailable()),
    Match.when({ connections: "unavailable" }, () => AgentRead.Unavailable()),
    Match.when({ connections: "unauthorized" }, () => AgentRead.Denied()),
    Match.orElse((value) => {
      if (!value.projectId || value.connections !== "ready") {
        return value.copyFailed
          ? AgentRead.CopyFailed()
          : value.configurationCopied
            ? AgentRead.Copied()
            : AgentRead.Idle()
      }
      const matching = grantsForProject(value.grants, value.projectId)
      if (matching.length === 0) {
        return AgentRead.WrongProject()
      }
      const authenticated = EffectArray.some(
        matching,
        (grant) => grant.lastAuthenticatedAt !== null,
      )
      if (!authenticated) {
        return AgentRead.Granted()
      }
      return AgentRead.Authenticated()
    }),
  )
