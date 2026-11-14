"use client"
import type { ReactNode } from "react"
import { Button } from "@flowmark/ui"
import { usePathname, useSearchParams } from "next/navigation"
import { useProject } from "../projects/project-context"
import { BusinessWorkspace } from "./business-workspace"
export function BusinessBoundary({
  children,
}: {
  readonly children: ReactNode
}) {
  const { current, pending, error, retry } = useProject()
  const pathname = usePathname()
  const params = useSearchParams()
  const utility =
    pathname === "/settings" ||
    pathname === "/connect" ||
    pathname === "/investigations" ||
    pathname.startsWith("/account")
  if (!utility && pending) {
    return <p role="status">Checking project access…</p>
  }
  if (!utility && error) {
    return (
      <div role="alert" className="grid justify-items-start gap-3">
        <p>Project access is unavailable.</p>
        <Button variant="outline" onClick={retry}>
          Refresh project list
        </Button>
      </div>
    )
  }
  if (!utility && !current) {
    return (
      <p role="status">Select a project to inspect its authorized evidence.</p>
    )
  }
  return current &&
    !utility &&
    (current.role === "business" || params.has("businessSelection")) ? (
    <BusinessWorkspace key={current.id} projectId={current.id} />
  ) : (
    children
  )
}
