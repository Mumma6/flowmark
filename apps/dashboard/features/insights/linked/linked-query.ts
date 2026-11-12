"use client"

import { skipToken, useQuery } from "@tanstack/react-query"
import { useTRPCClient } from "../../platform/api-trpc"
import type { LinkedComparisonSelection } from "@flowmarkdev/core"

export function useLinkedComparisonQueries(
  selection: LinkedComparisonSelection | null,
) {
  const client = useTRPCClient()
  const query = selection?.query
  const evidenceInput = selection?.evidence
    ? { query: selection.query, ...selection.evidence, limit: 25 }
    : undefined
  const analysis = useQuery({
    queryKey: ["linked-comparison", selection?.projectId, query],
    queryFn: query
      ? ({ signal }) =>
          client.workflow.linkedComparison.query(query, { signal })
      : skipToken,
    retry: false,
    staleTime: 0,
  })
  const evidence = useQuery({
    queryKey: ["linked-evidence", selection?.projectId, evidenceInput],
    queryFn: evidenceInput
      ? ({ signal }) =>
          client.workflow.linkedEvidence.query(evidenceInput, { signal })
      : skipToken,
    retry: false,
    staleTime: 0,
  })
  return { analysis, evidence }
}
