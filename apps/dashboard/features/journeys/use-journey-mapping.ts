"use client"

import { useQueries } from "@tanstack/react-query"
import { ReferenceJourneyQuerySchema } from "@flowmarkdev/core"
import { Array, Result, Schema } from "effect"
import { useState } from "react"
import { useTRPC } from "../platform/api-trpc"
import { useSnapshot } from "../projects/queries"
import type { JourneySelection } from "./journey-selection"

export function useJourneyMapping(selection: JourneySelection) {
  const trpc = useTRPC()
  const snapshot = useSnapshot()
  const [namespaces, setNamespaces] = useState(() => [
    { workflow: selection.query.workflow, key: selection.query.key },
    ...Array.filter(
      selection.query.namespaces,
      (namespace) => namespace.workflow !== selection.query.workflow,
    ),
  ])
  const fields = useQueries({
    queries: Array.map(namespaces, (namespace) =>
      trpc.resultDeclarations.searchFields.queryOptions(
        { projectId: selection.projectId, workflow: namespace.workflow },
        { enabled: namespace.workflow.length > 0, retry: false },
      ),
    ),
  })
  const parsed = Schema.decodeUnknownResult(ReferenceJourneyQuerySchema)({
    ...selection.query,
    anchorRunId: undefined,
    cursor: undefined,
    candidateCursor: undefined,
    namespaces,
  })
  const valid =
    Result.isSuccess(parsed) &&
    Array.every(
      fields,
      (query, index) =>
        !query.isPending &&
        !query.isError &&
        Array.some(
          query.data ?? [],
          (field) =>
            field.role === "lookup" && field.key === namespaces[index]?.key,
        ),
    )
  const update = (index: number, workflow: string, key: string) =>
    setNamespaces((current) =>
      Array.map(current, (namespace, at) =>
        at === index ? { workflow, key } : namespace,
      ),
    )
  return { snapshot, namespaces, setNamespaces, fields, parsed, valid, update }
}
