"use client"

import type { AppRouter } from "@flowmark/server/trpc"
import { useQuery } from "@tanstack/react-query"
import type { inferRouterOutputs } from "@trpc/server"
import { usePathname, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useTRPC } from "../platform/api-trpc"
import { useProject } from "../projects/project-context"
import {
  businessEvidencePath,
  selectBusinessOutcomes,
  type BusinessWindow,
  type EvidenceSelection,
} from "./business-outcomes-model"
import { useResultDeclarations, useWorkflowSearchFields } from "./queries"

type Data = inferRouterOutputs<AppRouter>["project"]["businessInsights"]
type Window = Data["windows"][number]

export function useBusinessOutcomes(
  workflow: string,
  lockedWindow?: BusinessWindow,
) {
  const { current } = useProject()
  const trpc = useTRPC()
  const params = useSearchParams()
  const pathname = usePathname()
  const declarations = useResultDeclarations(
    current?.id ?? "",
    workflow,
    Boolean(current),
  )
  const dimensions = useWorkflowSearchFields(
    current?.id ?? "",
    workflow,
    Boolean(current),
  )
  const [revision, setRevision] = useState<string | undefined>(
    params.get("biRevision") ?? undefined,
  )
  const [formPath, setFormPath] = useState(params.get("biPath") ?? "")
  const [formNumerator, setFormNumerator] = useState(
    params.get("biNumerator") ?? "",
  )
  const [formDenominator, setFormDenominator] = useState(
    params.get("biDenominator") ?? "",
  )
  const [formDimensionValue, setFormDimensionValue] = useState(
    params.get("biDimensionValue") ?? "",
  )
  const model = selectBusinessOutcomes(
    workflow,
    params,
    declarations.data ?? [],
    lockedWindow,
  )
  const {
    selectedRevision,
    hasAggregatableField,
    fields,
    field,
    after,
    before,
    validDates,
    input,
  } = model
  const formRevision = revision ?? selectedRevision
  const formFields =
    declarations.data
      ?.find((item) => item.revision === formRevision)
      ?.fields.filter((item) => item.aggregate) ?? []
  const formCountFields = formFields.filter((item) => item.kind === "count")
  const selectedFormPath =
    formPath || (formFields[0] ? JSON.stringify(formFields[0].path) : "")
  const insights = useQuery({
    ...trpc.project.businessInsights.queryOptions(input),
    enabled: Boolean(current && field && validDates),
  })
  const [dimension, setDimension] = useState(params.get("biDimension") ?? "")
  const dimensionField = dimensions.data?.find(
    (item) => item.key === dimension && item.role === "dimension",
  )
  const evidence = (window: Window, selection?: EvidenceSelection) =>
    businessEvidencePath(model, window, selection)
  return {
    params,
    pathname,
    declarations,
    dimensions,
    setRevision,
    setFormPath,
    formNumerator,
    setFormNumerator,
    formDenominator,
    setFormDenominator,
    formDimensionValue,
    setFormDimensionValue,
    selectedRevision,
    formRevision,
    formFields,
    formCountFields,
    selectedFormPath,
    hasAggregatableField,
    fields,
    field,
    after,
    before,
    validDates,
    insights,
    dimension,
    setDimension,
    dimensionField,
    input,
    evidence,
  }
}
