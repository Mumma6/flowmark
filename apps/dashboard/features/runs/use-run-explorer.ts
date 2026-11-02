"use client"

import { useQuery } from "@tanstack/react-query"
import { usePathname, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { useTRPC } from "../../lib/api/trpc"
import { useProject } from "../projects/project-context"
import {
  useResultDeclarations,
  useWorkflowSearchFields,
} from "../results/queries"
import {
  buildRunListInput,
  explorerDefaults,
  readExplorerFilters,
  type ExplorerFilters,
} from "./explorer-filters"

export function useRunExplorer(workflow?: string) {
  const trpc = useTRPC()
  const { current } = useProject()
  const params = useSearchParams()
  const pathname = usePathname()
  const signature = params.toString()
  const filters = useMemo(() => readExplorerFilters(params), [params])
  const setFilters = (next: ExplorerFilters) => {
    const url = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(next)) {
      if (value === explorerDefaults[key as keyof ExplorerFilters]) {
        url.delete(key)
      } else {
        url.set(key, value)
      }
    }
    window.history.replaceState(
      null,
      "",
      `${pathname}${url.size ? `?${url}` : ""}`,
    )
  }
  const [pagination, setPagination] = useState<{
    signature: string
    stack: (string | null)[]
  }>({ signature: "", stack: [null] })
  const cursorStack =
    pagination.signature === signature ? pagination.stack : [null]
  const setCursorStack = (
    next: (string | null)[] | ((stack: (string | null)[]) => (string | null)[]),
  ) =>
    setPagination({
      signature,
      stack: typeof next === "function" ? next(cursorStack) : next,
    })
  const pageIndex = cursorStack.length - 1
  const cursor = cursorStack[pageIndex] ?? null
  const update = (key: keyof ExplorerFilters, value: string) => {
    setFilters({
      ...filters,
      [key]: value,
      ...(key === "workflow" ? { businessKey: "", businessValue: "" } : {}),
    })
    setCursorStack([null])
  }
  const selectedWorkflow =
    workflow ?? (filters.workflow !== "all" ? filters.workflow : "")
  const searchFields = useWorkflowSearchFields(
    current?.id ?? "",
    selectedWorkflow,
    Boolean(current && selectedWorkflow),
  )
  const declarations = useResultDeclarations(
    current?.id ?? "",
    selectedWorkflow,
    Boolean(current && selectedWorkflow),
  )
  const resultFields =
    declarations.data?.find(
      (item) => item.revision === filters.definitionRevision,
    )?.fields ?? []
  const selectedField = searchFields.data?.find(
    (field) => field.key === filters.businessKey,
  )
  const queryInput = useMemo(
    () => buildRunListInput(filters, workflow, cursor),
    [filters, workflow, cursor],
  )
  const list = useQuery({
    ...trpc.run.list.queryOptions(queryInput),
    enabled: Boolean(current),
  })
  const runs = list.data?.runs ?? []
  const total = list.data?.total ?? 0
  const nextCursor = list.data?.nextCursor ?? null
  return {
    filters,
    setFilters,
    setCursorStack,
    pageIndex,
    update,
    selectedWorkflow,
    searchFields,
    declarations,
    resultFields,
    selectedField,
    list,
    runs,
    total,
    nextCursor,
  }
}
