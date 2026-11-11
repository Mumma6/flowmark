"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"
import { authClient } from "../../auth/auth-client"
import { useApiOrigin } from "../../platform/runtime-config"
import { useTRPC } from "../../platform/api-trpc"
import { useProjectKeys } from "../../projects/keys-query"
import { useProject } from "../../projects/project-context"
import {
  clearConnectSetupTransient,
  connectSetupStages,
  markSetupCopied,
  type ConnectSetupTransient,
  type SetupPath,
} from "./connect-setup-state"
import { flowmarkAgentPrompt } from "./setup-instructions"

export function useConnectSetup() {
  const trpc = useTRPC()
  const origin = useApiOrigin()
  const { current } = useProject()
  const keys = useProjectKeys()
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const [transient, setTransient] = useState<ConnectSetupTransient>(
    clearConnectSetupTransient,
  )
  const snapshot = useQuery({
    ...trpc.project.snapshot.queryOptions(),
    enabled: Boolean(current?.id),
  })
  const hasWriteKey = (keys.data?.apiKeys.length ?? 0) > 0
  const hasRuns = (snapshot.data?.metrics.totalRuns ?? 0) > 0
  const agentPrompt = useMemo(() => flowmarkAgentPrompt(origin), [origin])

  useEffect(() => {
    setTransient(clearConnectSetupTransient())
  }, [current?.id, email])

  const markCopied = (path: SetupPath) => {
    setTransient((state) => markSetupCopied(state, path))
  }

  const stages = useMemo(
    () =>
      connectSetupStages({
        hasWriteKey,
        hasRuns,
        transient,
      }),
    [hasRuns, hasWriteKey, transient],
  )

  return {
    origin,
    current,
    keys,
    snapshot,
    hasWriteKey,
    hasRuns,
    agentPrompt,
    stages,
    markCopied,
  }
}
