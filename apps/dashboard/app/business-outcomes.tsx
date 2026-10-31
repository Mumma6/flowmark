"use client"

import Link from "next/link"
import { useState } from "react"
import { useSearchParams, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Input,
  NativeSelect,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@flowmark/ui"
import { useProject } from "./project-context"
import { useTRPC } from "../lib/trpc"
import { DataState } from "./dashboard-components"
import { defaultIntelligenceQuery } from "./dashboard-data"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"

type Data = inferRouterOutputs<AppRouter>["project"]["businessInsights"]
type Window = Data["windows"][number]

export function BusinessOutcomes({ workflow }: { workflow: string }) {
  const { current } = useProject()
  const trpc = useTRPC()
  const params = useSearchParams()
  const pathname = usePathname()
  const declarations = useQuery(
    trpc.resultDeclarations.list.queryOptions(
      { projectId: current?.id ?? "", workflow },
      { enabled: Boolean(current) },
    ),
  )
  const dimensions = useQuery(
    trpc.resultDeclarations.searchFields.queryOptions(
      { projectId: current?.id ?? "", workflow },
      { enabled: Boolean(current) },
    ),
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
  const selectedRevision =
    params.get("biRevision") ??
    declarations.data?.find((item) =>
      item.fields.some((field) => field.aggregate),
    )?.revision ??
    ""
  const formRevision = revision ?? selectedRevision
  const formFields =
    declarations.data
      ?.find((item) => item.revision === formRevision)
      ?.fields.filter((item) => item.aggregate) ?? []
  const formCountFields = formFields.filter((item) => item.kind === "count")
  const selectedFormPath =
    formPath || (formFields[0] ? JSON.stringify(formFields[0].path) : "")
  const declaration = declarations.data?.find(
    (item) => item.revision === selectedRevision,
  )
  const fields = declaration?.fields.filter((field) => field.aggregate) ?? []
  const field = params.has("biPath")
    ? fields.find((item) => JSON.stringify(item.path) === params.get("biPath"))
    : fields[0]
  const defaults = defaultIntelligenceQuery(workflow)
  const after =
    params.get("biAfter") ?? defaults.currentStartedAfter.slice(0, 10)
  const before =
    params.get("biBefore") ?? defaults.currentStartedBefore.slice(0, 10)
  const currentStartedAfter = `${after}T00:00:00.000Z`
  const currentStartedBefore = `${before}T00:00:00.000Z`
  const duration =
    Date.parse(currentStartedBefore) - Date.parse(currentStartedAfter)
  const validDates =
    Number.isFinite(duration) && duration > 0 && duration <= 31 * 86400000
  const countFields = fields.filter((item) => item.kind === "count")
  const numerator = countFields.find(
    (item) => JSON.stringify(item.path) === params.get("biNumerator"),
  )?.path
  const denominator = countFields.find(
    (item) => JSON.stringify(item.path) === params.get("biDenominator"),
  )?.path
  const input = {
    workflow,
    revision: selectedRevision,
    path: field?.path ?? [],
    currentStartedAfter,
    currentStartedBefore,
    previousStartedAfter: validDates
      ? new Date(Date.parse(currentStartedAfter) - duration).toISOString()
      : currentStartedAfter,
    previousStartedBefore: currentStartedAfter,
    ...(params.get("biDimension")
      ? {
          businessKey: params.get("biDimension") ?? "",
          businessValue: params.get("biDimensionValue") ?? "",
        }
      : {}),
    ...(params.get("biNumerator") ? { numerator: numerator ?? [] } : {}),
    ...(params.get("biDenominator") ? { denominator: denominator ?? [] } : {}),
    ...(params.get("biReleaseA") || params.get("biReleaseB")
      ? {
          releaseA: params.get("biReleaseA") || undefined,
          releaseB: params.get("biReleaseB") || undefined,
        }
      : {}),
  }
  const insights = useQuery({
    ...trpc.project.businessInsights.queryOptions(input),
    enabled: Boolean(current && field && validDates),
  })
  const [dimension, setDimension] = useState(params.get("biDimension") ?? "")
  const dimensionField = dimensions.data?.find(
    (item) => item.key === dimension && item.role === "dimension",
  )
  const evidence = (
    window: Window,
    selection?: {
      outcome?: string
      ratio?: boolean
      resultSelection?: {
        value: string | number
        reason?: string
        operator: "eq" | "gte" | "lte"
      }
    },
  ) => {
    const query = new URLSearchParams({
      workflow,
      terminalOnly: "true",
      startedAfterExact:
        window.scope === "previous"
          ? input.previousStartedAfter
          : currentStartedAfter,
      startedBeforeExclusive:
        window.scope === "previous"
          ? input.previousStartedBefore
          : currentStartedBefore,
    })
    if (input.businessKey) {
      query.set("businessKey", input.businessKey)
      query.set("businessValue", input.businessValue ?? "")
    }
    if (window.scope === "releaseA") {
      query.set("release", input.releaseA ?? "")
    }
    if (window.scope === "releaseB") {
      query.set("release", input.releaseB ?? "")
    }
    if (selection?.outcome) {
      query.set("outcome", selection.outcome)
    }
    if (selection?.ratio && input.numerator && input.denominator) {
      query.set("definitionRevision", selectedRevision)
      query.set("ratioNumerator", JSON.stringify(input.numerator))
      query.set("ratioDenominator", JSON.stringify(input.denominator))
    }
    if (selection?.resultSelection) {
      query.set("definitionRevision", selectedRevision)
      query.set("resultPath", JSON.stringify(field?.path))
      query.set("resultOperator", selection.resultSelection.operator)
      query.set("resultValue", String(selection.resultSelection.value))
      query.set(
        "resultKind",
        typeof selection.resultSelection.value === "number"
          ? "count"
          : "category",
      )
      if (selection.resultSelection.reason) {
        query.set("resultReason", selection.resultSelection.reason)
      }
    }
    return `/runs?${query}`
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reported business outcomes</CardTitle>
        <CardDescription>
          Runs started in the selected UTC interval [after, before). Final
          evidence includes completed and failed runs; reports are excluded.
          Each attempt counts once. Browser reports remain untrusted.
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
        {declarations.data &&
          !declarations.data.some((item) =>
            item.fields.some((entry) => entry.aggregate),
          ) && (
            <p className="text-sm text-muted-foreground">
              No aggregatable result fields declared. Create an immutable
              revision below with explicit aggregation and use it on the
              original run start.
            </p>
          )}
        <form
          action={pathname}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <label className="text-sm">
            Definition revision
            <NativeSelect
              name="biRevision"
              value={formRevision}
              onChange={(event) => {
                setRevision(event.target.value)
                setFormPath("")
                setFormNumerator("")
                setFormDenominator("")
              }}
            >
              <option value="">Select revision</option>
              {declarations.data?.map((item) => (
                <option key={item.revision}>{item.revision}</option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Reported field
            <NativeSelect
              name="biPath"
              value={selectedFormPath}
              onChange={(event) => setFormPath(event.target.value)}
            >
              <option value="">Select field</option>
              {formFields.map((item) => (
                <option
                  key={JSON.stringify(item.path)}
                  value={JSON.stringify(item.path)}
                >
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Started after (UTC, inclusive)
            <Input name="biAfter" type="date" defaultValue={after} required />
          </label>
          <label className="text-sm">
            Started before (UTC, exclusive)
            <Input name="biBefore" type="date" defaultValue={before} required />
          </label>
          <label className="text-sm">
            Ratio numerator
            <NativeSelect
              name="biNumerator"
              value={formNumerator}
              onChange={(event) => setFormNumerator(event.target.value)}
            >
              <option value="">No ratio</option>
              {formCountFields.map((item) => (
                <option
                  key={JSON.stringify(item.path)}
                  value={JSON.stringify(item.path)}
                >
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Ratio denominator
            <NativeSelect
              name="biDenominator"
              value={formDenominator}
              onChange={(event) => setFormDenominator(event.target.value)}
            >
              <option value="">No ratio</option>
              {formCountFields.map((item) => (
                <option
                  key={JSON.stringify(item.path)}
                  value={JSON.stringify(item.path)}
                >
                  {item.label}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Release A
            <Input
              name="biReleaseA"
              maxLength={128}
              defaultValue={params.get("biReleaseA") ?? ""}
            />
          </label>
          <label className="text-sm">
            Release B
            <Input
              name="biReleaseB"
              maxLength={128}
              defaultValue={params.get("biReleaseB") ?? ""}
            />
          </label>
          <label className="text-sm">
            Declared dimension
            <NativeSelect
              name="biDimension"
              value={dimension}
              onChange={(event) => {
                setDimension(event.target.value)
                setFormDimensionValue("")
              }}
            >
              <option value="">All dimensions</option>
              {dimensions.data
                ?.filter((item) => item.role === "dimension")
                .map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.key}
                  </option>
                ))}
            </NativeSelect>
          </label>
          <label className="text-sm">
            Dimension value
            <NativeSelect
              name="biDimensionValue"
              value={formDimensionValue}
              onChange={(event) => setFormDimensionValue(event.target.value)}
            >
              <option value="">Select value</option>
              {dimensionField?.role === "dimension" &&
                dimensionField.values.map((value) => (
                  <option key={value}>{value}</option>
                ))}
            </NativeSelect>
          </label>
          <Button
            type="submit"
            disabled={
              !formFields.some(
                (item) => JSON.stringify(item.path) === selectedFormPath,
              )
            }
          >
            Apply outcome selection
          </Button>
        </form>
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
        {insights.data && !insights.error && (
          <>
            <p className="text-sm text-muted-foreground">
              Definition {selectedRevision} · {field?.label} · reported{" "}
              {field?.unit ?? "items"} across runs, not unique entities. Current{" "}
              {after} → {before}; previous{" "}
              {input.previousStartedAfter.slice(0, 10)} → {after}. Late terminal
              evidence can change a start cohort. Only compatible finished
              observations enter field totals. Unknown values remain separate.
            </p>
            <p className="text-sm">
              Release comparison:{" "}
              {insights.data.releaseComparison.available
                ? "Available for the selected definition; each release has at least five known observations. Differences are descriptive, not causal."
                : insights.data.releaseComparison.reason}
            </p>
            {insights.data.windows
              .filter(
                (window) =>
                  !window.scope.startsWith("release") ||
                  insights.data?.releaseComparison.available,
              )
              .map((window) => (
                <section
                  key={window.scope}
                  className="space-y-3 border-t pt-4"
                  aria-label={`${window.scope} business cohort`}
                >
                  <h3 className="font-medium">
                    {window.scope === "releaseA"
                      ? `Release ${input.releaseA}`
                      : window.scope === "releaseB"
                        ? `Release ${input.releaseB}`
                        : window.scope}{" "}
                    · {window.totalRuns} started runs
                  </h3>
                  <p className="text-sm">
                    Finished {window.finishedRuns}; technical failures{" "}
                    {window.failedRuns}; no terminal outcome {window.openRuns}.
                    Field coverage {window.knownRuns}/{window.finishedRuns}{" "}
                    finished runs: incompatible/missing revision{" "}
                    {window.incompatibleRevision}, missing result{" "}
                    {window.missingResult}, missing field {window.missingField},
                    wrong type {window.wrongType}, unknown category{" "}
                    {window.unknownCategory}.
                  </p>
                  {window.knownRuns < 5 && (
                    <p className="text-sm text-muted-foreground">
                      Small sample: fewer than five known observations. No
                      regression conclusion is supported.
                    </p>
                  )}
                  <p className="text-sm">
                    Reported total:{" "}
                    {window.total ?? "Unknown / no numeric observations"}.{" "}
                    {window.knownRuns} known field observations; absent values
                    are excluded, never zero-filled.
                  </p>
                  {input.numerator && (
                    <p className="text-sm">
                      Weighted ratio:{" "}
                      {window.ratio.value === null
                        ? "Unavailable (zero denominator or no jointly known observations)"
                        : window.ratio.value.toPrecision(5)}{" "}
                      = {window.ratio.numerator ?? "unknown"} /{" "}
                      {window.ratio.denominator ?? "unknown"}, across{" "}
                      {window.ratio.knownRuns} jointly valid finished runs.
                    </p>
                  )}
                  <Link className="text-sm underline" href={evidence(window)}>
                    Explore finished cohort
                  </Link>
                  {field?.kind === "count" && (
                    <Link
                      className="ml-3 text-sm underline"
                      href={evidence(window, {
                        resultSelection: { operator: "gte", value: 0 },
                      })}
                    >
                      Contributing count observations
                    </Link>
                  )}
                  {input.numerator && (
                    <Link
                      className="ml-3 text-sm underline"
                      href={evidence(window, { ratio: true })}
                    >
                      Contributing ratio observations
                    </Link>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reported outcome</TableHead>
                        <TableHead>Runs / finished runs</TableHead>
                        <TableHead>Evidence</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {window.outcomes.map((outcome) => (
                        <TableRow key={outcome.value}>
                          <TableCell>{outcome.value}</TableCell>
                          <TableCell>
                            {outcome.runs} / {window.finishedRuns}
                          </TableCell>
                          <TableCell>
                            <Link
                              className="underline"
                              href={evidence(window, {
                                outcome: outcome.value,
                              })}
                            >
                              Contributing runs
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-muted-foreground">
                    Missing canonical outcome: {window.missingOutcome}. Other
                    outcomes outside the top 20: {window.otherOutcomeRuns}.
                    Technical completion does not prove business accomplishment.
                  </p>
                  {window.categories.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Declared category/reason</TableHead>
                          <TableHead>Known runs / field observations</TableHead>
                          <TableHead>Reported total</TableHead>
                          <TableHead>Evidence</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {window.categories.map((category) => (
                          <TableRow key={category.value}>
                            <TableCell>{category.value}</TableCell>
                            <TableCell>
                              {category.runs} / {window.knownRuns}
                            </TableCell>
                            <TableCell>
                              {category.total ?? "Not a count / unknown"}
                            </TableCell>
                            <TableCell>
                              <Link
                                className="underline"
                                href={evidence(window, {
                                  resultSelection:
                                    field?.kind === "category"
                                      ? {
                                          operator: "eq",
                                          value: category.value,
                                        }
                                      : {
                                          operator: "gte",
                                          value: 0,
                                          reason: category.value,
                                        },
                                })}
                              >
                                Contributing runs
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm">
                      Daily start cohorts · UTC · same definition/coverage rules
                    </summary>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Known field / finished runs</TableHead>
                          <TableHead>Reported total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {window.daily.map((day) => (
                          <TableRow key={day.date}>
                            <TableCell>{day.date}</TableCell>
                            <TableCell>
                              {day.knownRuns} / {day.finishedRuns}
                            </TableCell>
                            <TableCell>
                              {day.total ?? "Unknown / not numeric"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </details>
                </section>
              ))}
            {!insights.data.releaseComparison.available &&
              insights.data.windows
                .filter((window) => window.scope.startsWith("release"))
                .map((window) => (
                  <p key={window.scope} className="text-sm">
                    {window.scope}: {window.knownRuns}/{window.finishedRuns}{" "}
                    known; {window.incompatibleRevision} incompatible/missing
                    revisions.
                  </p>
                ))}
          </>
        )}
      </CardContent>
    </Card>
  )
}
