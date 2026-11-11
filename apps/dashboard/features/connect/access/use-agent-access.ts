"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { authClient } from "../../auth/auth-client"
import {
  useApiOrigin,
  useAgentAccessDeployment,
} from "../../platform/runtime-config"
import { useProject } from "../../projects/project-context"
import {
  agentAccessIntroCopy,
  agentClientGuides,
  agentExampleQuestions,
  manualEvidenceHandoffIntro,
} from "./agent-access-guidance"
import {
  clearAgentAccessTransient,
  markAgentAccessCopied,
  markAgentAccessCopyFailed,
  type AgentAccessTransient,
} from "./agent-access-state"

const subscribe = () => () => undefined

export function useAgentAccess() {
  const apiOrigin = useApiOrigin()
  const { current } = useProject()
  const session = authClient.useSession()
  const email = session.data?.user.email ?? ""
  const studioOrigin = useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => "",
  )
  const [transient, setTransient] = useState<AgentAccessTransient>(
    clearAgentAccessTransient,
  )

  useEffect(() => {
    setTransient(clearAgentAccessTransient())
  }, [current?.id, email])

  const deployment = useAgentAccessDeployment()
  const intro = useMemo(() => agentAccessIntroCopy(), [])
  const clients = useMemo(
    () =>
      agentClientGuides(
        deployment.kind === "enabled" ? deployment.mcpUrl : undefined,
      ),
    [deployment],
  )
  const examples = useMemo(
    () => agentExampleQuestions(current?.name ?? null),
    [current?.name],
  )
  const handoffIntro = useMemo(
    () => manualEvidenceHandoffIntro(current?.name ?? null, studioOrigin),
    [current?.name, studioOrigin],
  )

  const markCopied = (target: Parameters<typeof markAgentAccessCopied>[1]) => {
    setTransient((state) => markAgentAccessCopied(state, target))
  }

  const markCopyFailed = () => {
    setTransient((state) => markAgentAccessCopyFailed(state))
  }

  return {
    apiOrigin,
    studioOrigin,
    current,
    deployment,
    intro,
    clients,
    examples,
    handoffIntro,
    transient,
    markCopied,
    markCopyFailed,
  }
}
