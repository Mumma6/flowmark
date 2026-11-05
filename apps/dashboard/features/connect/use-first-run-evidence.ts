"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { useTRPC } from "../platform/api-trpc"
import { verifyFirstRunEvidence } from "./first-run-evidence"

export function useFirstRunEvidence(enabled: boolean) {
  const trpc = useTRPC()
  const list = useQuery({
    ...trpc.run.list.queryOptions({ limit: 1 }),
    enabled,
  })
  const verification = useMemo(
    () =>
      verifyFirstRunEvidence(list.data?.runs, list.isError && !list.isPending),
    [list.data?.runs, list.isError, list.isPending],
  )
  const hasVerifiedRun = verification.kind === "verified"
  return { list, verification, hasVerifiedRun }
}
