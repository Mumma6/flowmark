"use client"
import { Alert, AlertDescription } from "@flowmark/ui"
import Link from "next/link"
import type { ReactNode } from "react"
import { useProject } from "../projects/project-context"

/** Presentation only: the API and persistence independently enforce ownership. */
export function ProjectOwnerOnly({
  children,
}: {
  readonly children: ReactNode
}) {
  const { current } = useProject()
  if (current && current.role !== "owner") {
    return (
      <Alert>
        <AlertDescription>
          These controls require the project owner. Your current role cannot
          manage keys, process metadata or project data.{" "}
          <Link
            href="/settings?section=access"
            className="text-primary underline"
          >
            Review project access
          </Link>
          .
        </AlertDescription>
      </Alert>
    )
  }
  return children
}
