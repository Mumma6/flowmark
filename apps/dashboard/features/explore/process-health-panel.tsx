"use client"

import {
  Alert,
  AlertDescription,
  Button,
  Input,
  NativeSelect,
} from "@flowmark/ui"
import type { ProcessHealthQuery, ProcessHealthRecord } from "@flowmarkdev/core"
import { ExpectationIdentifierSchema } from "@flowmarkdev/core"
import { useQuery } from "@tanstack/react-query"
import { Schema } from "effect"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"
import { useTRPC, useTRPCClient } from "../platform/api-trpc"
import { periodDays } from "../period/period"
import type { ExplorerFilters } from "../runs/explorer/explorer-filters"
import {
  readInspectorRunId,
  confirmationInvestigationPath,
} from "../runs/investigation/investigation-navigation"
import {
  healthExpectationQueryKey,
  healthPeriodQueryKey,
  processHealthSelection,
} from "./process-health-selection"
import { ProcessHealthResult } from "./process-health-result"

export function ProcessHealthPanel({
  projectId,
  filters,
}: {
  projectId: string
  filters: ExplorerFilters
}) {
  const params = useSearchParams()
  const pathname = usePathname()
  const inspectorOpen = Boolean(readInspectorRunId(pathname))
  const source = inspectorOpen ? (params.get("from") ?? "/") : `/?${params}`
  const name = params.get(healthExpectationQueryKey) ?? ""
  const days = params.get(healthPeriodQueryKey)
  const [now] = useState(() => new Date())
  const definition = processHealthSelection(filters, name, days, now)
  const formId = useId()
  const update = (expectation: string, range: string) => {
    const next = new URLSearchParams(window.location.search)
    next.set(healthExpectationQueryKey, expectation)
    next.set(healthPeriodQueryKey, range)
    window.history.pushState(null, "", `/?${next}`)
  }
  if (filters.workflow === "all") {
    return null
  }
  return (
    <section
      aria-labelledby="process-health-title"
      className="min-w-0 rounded-xl border border-border bg-card shadow-sm"
    >
      <header className="border-b border-border bg-primary/5 px-4 py-4 sm:px-6">
        <h2
          id="process-health-title"
          tabIndex={-1}
          className="text-sm font-semibold"
        >
          Process health
        </h2>
        <p className="mt-1 break-words text-xs text-muted-foreground">
          {filters.workflow}
        </p>
      </header>
      <div className="grid gap-4 p-4 sm:px-6">
        {definition.kind === "unsupported" ? (
          <Alert>
            <AlertDescription>
              Health is unavailable with these execution filters:{" "}
              {definition.filters.join(", ")}. Clear those filters to assess
              this process.
            </AlertDescription>
          </Alert>
        ) : definition.kind === "unavailable-window" ? (
          <Alert>
            <AlertDescription>
              Health needs both a start and an exclusive end within 31 days.
              Clear the run date filters to use a standard health period.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <form
              key={`${name}:${days}`}
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                const expectation = data.get("name")
                if (Schema.is(ExpectationIdentifierSchema)(expectation)) {
                  const range = data.get("days")
                  update(expectation, range === "30" ? "30" : "7")
                } else {
                  const input = event.currentTarget.elements.namedItem("name")
                  if (input instanceof HTMLInputElement) {
                    input.setCustomValidity(
                      "Enter the exact expectation name without control characters.",
                    )
                    input.reportValidity()
                  }
                }
              }}
            >
              <div className="grid min-w-0 flex-[1_1_12rem] gap-1">
                <label
                  htmlFor={`${formId}-name`}
                  className="text-xs font-medium"
                >
                  Expectation name
                </label>
                <Input
                  id={`${formId}-name`}
                  name="name"
                  required
                  maxLength={128}
                  defaultValue={name}
                  placeholder="Exact name reported by the application"
                  onInput={(event) => event.currentTarget.setCustomValidity("")}
                />
              </div>
              {!definition.explicitWindow && (
                <div className="grid gap-1">
                  <label
                    htmlFor={`${formId}-period`}
                    className="text-xs font-medium"
                  >
                    Health period
                  </label>
                  <NativeSelect
                    id={`${formId}-period`}
                    name="days"
                    defaultValue={periodDays(days)}
                  >
                    <option value="7">Last 7 UTC days</option>
                    <option value="30">Last 30 UTC days</option>
                  </NativeSelect>
                </div>
              )}
              <Button type="submit" variant="outline">
                Assess health
              </Button>
            </form>
            {definition.kind === "selected" ? (
              <HealthAssessment
                key={JSON.stringify(definition.input)}
                projectId={projectId}
                input={definition.input}
                source={source}
                inspectorOpen={inspectorOpen}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Confirmation health needs a reported confirmation name. Open a
                recorded run and look under Confirmations for the name to use
                here.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  )
}

const utcBoundary = (value: string) => value.replace("T", " ").replace(/Z$/, "")

function HealthAssessment({
  projectId,
  input,
  source,
  inspectorOpen,
}: {
  projectId: string
  input: ProcessHealthQuery
  source: string
  inspectorOpen: boolean
}) {
  const trpc = useTRPC()
  const client = useTRPCClient()
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([
    undefined,
  ])
  const cursor = cursors.at(-1)
  const selection = { ...input, cursor }
  const query = useQuery({
    queryKey: [
      ...trpc.workflow.processHealth.queryKey(selection),
      { projectId },
    ],
    queryFn: ({ signal }) =>
      client.workflow.processHealth.query(selection, { signal }),
    refetchInterval: false,
    refetchOnWindowFocus: false,
  })
  const trigger = useRef<HTMLAnchorElement>(null)
  const refreshed =
    query.data?.status === "assessed" && query.data.freshness === "refreshed"

  useEffect(() => {
    if (inspectorOpen || !trigger.current) {
      return
    }
    const sourceRow = trigger.current
    trigger.current = null
    const frame = requestAnimationFrame(() => {
      ;(sourceRow.isConnected
        ? sourceRow
        : document.getElementById("process-health-title")
      )?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [inspectorOpen])

  const link = (record: ProcessHealthRecord) => {
    const href = confirmationInvestigationPath(
      record.runId,
      record.expectationId,
      source,
    )
    return (
      <Link
        href={href}
        scroll={false}
        className="w-fit break-all font-medium text-primary underline-offset-4 hover:underline"
        onNavigate={(event) => {
          event.preventDefault()
          const active = document.activeElement
          trigger.current = active instanceof HTMLAnchorElement ? active : null
          window.history.pushState(null, "", href)
        }}
      >
        {record.expectationId}
        <span className="sr-only">
          {" "}
          · Inspect confirmation on run {record.runId}
        </span>
      </Link>
    )
  }

  return (
    <>
      <p className="break-words text-xs leading-6 text-muted-foreground">
        Runs started from {utcBoundary(input.window.startedAfter)} UTC up to{" "}
        {utcBoundary(input.window.startedBefore)} UTC, exclusive.
        {input.baseline ? " Compared with the preceding period." : ""}
      </p>
      {query.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Assessing process health…
        </p>
      )}
      {query.error && (
        <Alert>
          <AlertDescription>
            <p role="alert" className="break-words">
              Process health could not be read. {query.error.message}
            </p>
            <Button
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              Retry health read
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!query.error && query.data?.status === "unsupported-scope" && (
        <Alert>
          <AlertDescription>
            Health is unavailable for this workflow in the selected project.
          </AlertDescription>
        </Alert>
      )}
      {!query.error && query.data?.status === "assessed" && (
        <ProcessHealthResult
          result={query.data}
          renderRecord={link}
          page={refreshed ? 1 : cursors.length}
          pending={query.isFetching}
          previous={() => setCursors((pages) => pages.slice(0, -1))}
          next={(next) =>
            setCursors((pages) => [...(refreshed ? [undefined] : pages), next])
          }
          refresh={() => void query.refetch()}
        />
      )}
    </>
  )
}
