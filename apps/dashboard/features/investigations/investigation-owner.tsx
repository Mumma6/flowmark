"use client"
import { createContext, useContext, type ReactNode } from "react"
/** Server-provided account identity scopes private query state across account changes. */
const Owner = createContext<string | null>(null)
export function InvestigationOwner({
  userId,
  children,
}: {
  userId: string
  children: ReactNode
}) {
  return <Owner.Provider value={userId}>{children}</Owner.Provider>
}
export const useInvestigationOwner = () => useContext(Owner)
