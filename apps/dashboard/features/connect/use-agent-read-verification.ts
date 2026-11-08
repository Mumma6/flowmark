"use client"

import { useQuery } from "@tanstack/react-query"
import { Array as EffectArray, Match, Result, Schema } from "effect"
import { useTRPC } from "../platform/api-trpc"
import type { RemoteAgentAccessDeployment } from "./agent-access-capability"
import type { AgentAccessTransient } from "./agent-access-state"
import {
  interpretAgentReadVerification,
  type AgentGrantObservation,
  type AgentReadVerification,
} from "./agent-access-verification"

const failureKind = (error: unknown) =>
  Schema.decodeUnknownResult(
    Schema.Struct({ data: Schema.Struct({ code: Schema.String }) }),
  )(error).pipe(
    Result.match({
      onFailure: () => "unavailable" as const,
      onSuccess: ({ data }) =>
        data.code === "UNAUTHORIZED" || data.code === "FORBIDDEN"
          ? ("unauthorized" as const)
          : ("unavailable" as const),
    }),
  )

export function useAgentReadVerification(input: {
  readonly deployment: RemoteAgentAccessDeployment
  readonly projectId: string | undefined
  readonly transient: AgentAccessTransient
  readonly clientSupported: boolean
}): AgentReadVerification {
  const trpc = useTRPC()
  const enabled = input.deployment.kind === "enabled"
  const connections = useQuery({
    ...trpc.agentAccess.list.queryOptions(),
    enabled,
  })
  const grants: readonly AgentGrantObservation[] = connections.data ?? []
  const projectId = input.projectId
  const authenticated =
    enabled &&
    projectId !== undefined &&
    EffectArray.some(
      grants,
      (grant) =>
        grant.lastAuthenticatedAt !== null &&
        EffectArray.some(
          grant.projectIds,
          (id) => id.toLowerCase() === projectId.toLowerCase(),
        ),
    )
  const runs = useQuery({
    ...trpc.run.list.queryOptions({ limit: 1 }),
    enabled: authenticated,
  })
  const configurationCopied =
    input.transient.handoffIntroCopied ||
    EffectArray.some(
      Object.values(input.transient.exampleQuestionsCopied),
      Boolean,
    ) ||
    EffectArray.some(
      Object.values(input.transient.clientGuidanceCopied),
      Boolean,
    )
  const runObservation = Match.value({
    authenticated,
    pending: runs.isPending,
    error: runs.isError,
  }).pipe(
    Match.when({ authenticated: false }, () => "unknown" as const),
    Match.when({ error: true }, () => failureKind(runs.error)),
    Match.when({ pending: true }, () => "unknown" as const),
    Match.orElse(() =>
      (runs.data?.runs.length ?? 0) === 0
        ? ("empty" as const)
        : ("present" as const),
    ),
  )
  return interpretAgentReadVerification({
    deployment: input.deployment.kind,
    clientSupported: input.clientSupported,
    configurationCopied,
    copyFailed: input.transient.copyFailed,
    connections: !enabled
      ? "ready"
      : connections.isPending
        ? "pending"
        : connections.isError
          ? "unavailable"
          : "ready",
    grants,
    projectId,
    runs: runObservation,
  })
}
