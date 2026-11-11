"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import Link from "next/link"
import { DataState } from "../../shared/dashboard-components"
import { useBusinessOutcomes } from "./use-business-outcomes"
import { OutcomeFilters } from "./outcome-filters"
import { OutcomeReport } from "./outcome-report"

export function BusinessOutcomes({
  workflow,
  lockedWindow,
}: {
  workflow: string
  lockedWindow?: { after: string; before: string; days: 7 | 30 }
}) {
  const {
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
  } = useBusinessOutcomes(workflow, lockedWindow)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reported business outcomes</CardTitle>
        <CardDescription>
          {lockedWindow
            ? `Runs started in the Insights window ${after} → ${before} UTC. Final evidence includes completed and failed runs; reports are excluded.`
            : "Runs started in the selected UTC interval [after, before). Final evidence includes completed and failed runs; reports are excluded. Each attempt counts once. Browser reports remain untrusted."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <DataState
          pending={declarations.isPending || dimensions.isPending}
          error={declarations.error ?? dimensions.error}
          retry={() => {
            void declarations.refetch()
            void dimensions.refetch()
          }}
        />
        {declarations.data && !hasAggregatableField && (
          <p className="text-sm text-muted-foreground">
            {lockedWindow ? (
              <>
                No aggregatable result fields are declared for this workflow.{" "}
                <Link
                  className="font-medium text-primary underline"
                  href={`/workflows/${encodeURIComponent(workflow)}`}
                >
                  Declare them on the workflow
                </Link>
                .
              </>
            ) : (
              "No aggregatable result fields declared. Create an immutable revision below with explicit aggregation and use it on the original run start."
            )}
          </p>
        )}
        <OutcomeFilters
          params={params}
          pathname={pathname}
          declarations={declarations}
          dimensions={dimensions}
          setRevision={setRevision}
          setFormPath={setFormPath}
          formNumerator={formNumerator}
          setFormNumerator={setFormNumerator}
          formDenominator={formDenominator}
          setFormDenominator={setFormDenominator}
          formDimensionValue={formDimensionValue}
          setFormDimensionValue={setFormDimensionValue}
          formRevision={formRevision}
          formFields={formFields}
          formCountFields={formCountFields}
          selectedFormPath={selectedFormPath}
          hasAggregatableField={hasAggregatableField}
          after={after}
          before={before}
          dimension={dimension}
          setDimension={setDimension}
          dimensionField={dimensionField}
          workflow={workflow}
          lockedWindow={lockedWindow}
        />
        {params.has("biPath") && !field && declarations.data && (
          <p role="alert">
            The selected result path is not aggregatable in this revision.
            Choose a declared field and apply.
          </p>
        )}
        {!validDates && (
          <p role="alert">Choose a positive interval of at most 31 days.</p>
        )}
        <DataState
          pending={Boolean(field && validDates && insights.isPending)}
          error={insights.error}
          retry={() => void insights.refetch()}
        />
        <OutcomeReport
          selectedRevision={selectedRevision}
          field={field}
          after={after}
          before={before}
          validDates={validDates}
          insights={insights}
          input={input}
          evidence={evidence}
          workflow={workflow}
        />
      </CardContent>
    </Card>
  )
}
