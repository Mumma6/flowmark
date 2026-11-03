"use client"

import { createContext, useContext, type ReactNode } from "react"

// Only the validated API URL crosses the server/client boundary. Hosted
// credentials and protection bypasses remain exclusively in server config.
const ApiOriginContext = createContext<string | null>(null)

export function RuntimeConfigProvider({
  apiOrigin,
  children,
}: {
  apiOrigin: string
  children: ReactNode
}) {
  return (
    <ApiOriginContext.Provider value={apiOrigin}>
      {children}
    </ApiOriginContext.Provider>
  )
}

export function useApiOrigin() {
  const origin = useContext(ApiOriginContext)
  if (origin === null) {
    throw new Error("useApiOrigin requires RuntimeConfigProvider")
  }
  return origin
}
