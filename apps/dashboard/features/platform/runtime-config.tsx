"use client"

import { createContext, useContext, type ReactNode } from "react"
import {
  remoteAgentAccessFromProbe,
  type RemoteAgentAccessDeployment,
} from "../connect/access/agent-access-capability"

// Only the validated API URL crosses the server/client boundary. Hosted
// credentials and protection bypasses remain exclusively in server config.
const ApiOriginContext = createContext<{
  apiOrigin: string
  agentAccess: RemoteAgentAccessDeployment
} | null>(null)

export function RuntimeConfigProvider({
  apiOrigin,
  agentAccess = remoteAgentAccessFromProbe({
    apiOrigin,
    status: 404,
    resource: null,
  }),
  children,
}: {
  apiOrigin: string
  agentAccess?: RemoteAgentAccessDeployment
  children: ReactNode
}) {
  return (
    <ApiOriginContext.Provider value={{ apiOrigin, agentAccess }}>
      {children}
    </ApiOriginContext.Provider>
  )
}

export function useApiOrigin() {
  const value = useContext(ApiOriginContext)
  if (value === null) {
    throw new Error("useApiOrigin requires RuntimeConfigProvider")
  }
  return value.apiOrigin
}

export function useAgentAccessDeployment() {
  const value = useContext(ApiOriginContext)
  if (value === null) {
    throw new Error("useAgentAccessDeployment requires RuntimeConfigProvider")
  }
  return value.agentAccess
}
