"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@flowmark/ui"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"
import { useTRPC } from "../lib/trpc"
import { useProject } from "./project-context"
import { DataState } from "./dashboard-components"
import { formatTimestamp } from "./dashboard-data"
import { JsonData } from "./run-event-table"

type Record =
  inferRouterOutputs<AppRouter>["run"]["expectations"]["expectations"][number]
export function expectationLabel(
  record: Pick<Record, "state" | "cancelledAfterDeadline">,
) {
  if (record.cancelledAfterDeadline) {
    return "Cancelled after deadline"
  }
  const labels = {
    pending: "Pending confirmation",
    overdue: "Overdue — no resolution observed",
    "met-on-time": "Observed on time",
    "met-late": "Observed late",
    cancelled: "Cancelled",
    unmatched: "Settlement recorded; declaration unavailable",
  }
  return labels[record.state]
}
export function RunExpectations({ id }: { id: string }) {
  const trpc = useTRPC(),
    { current } = useProject()
  const query = useQuery({
    ...trpc.run.expectations.queryOptions({ id }),
    enabled: Boolean(current),
    refetchInterval: 10000,
  })
  const data = query.data
  return (
    <Card>
      <CardHeader>
        <CardTitle>Expected confirmations</CardTitle>
        <CardDescription>
          Observed evidence, evaluated on read. A completed run does not fulfill
          a confirmation. No background notification is sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <DataState
          pending={query.isPending}
          error={query.error}
          retry={() => void query.refetch()}
        />
        {data && (
          <>
            <p className="text-xs text-muted-foreground">
              Observed at {formatTimestamp(data.asOf)} UTC ·{" "}
              {data.expectations.length} declared expectations ·{" "}
              {data.unmatched.length} unmatched settlements
            </p>
            {data.unavailableCount > 0 && (
              <Alert>
                <AlertDescription>
                  Expectation evidence unavailable under current access or
                  retention ({data.unavailableCount}). Incomplete evidence is
                  excluded from state counts.
                </AlertDescription>
              </Alert>
            )}
            {data.expectations.length + data.unmatched.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No retained expectation evidence. Absence does not prove
                business success or failure.
              </p>
            )}
            {[...data.expectations, ...data.unmatched].map((record) => (
              <section
                className="grid min-w-0 gap-3 rounded-lg border border-border p-4"
                key={record.reference.expectationId}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="break-all text-sm font-semibold">
                    {record.name ?? record.reference.expectationId}
                  </h3>
                  <Badge
                    variant={
                      record.state === "overdue" ? "destructive" : "outline"
                    }
                  >
                    {expectationLabel(record)}
                  </Badge>
                </div>
                <p className="break-all text-xs text-muted-foreground">
                  {record.reference.expectationId} ·{" "}
                  {record.source === "browser"
                    ? "Untrusted browser evidence"
                    : "Application server report — not independently verified"}
                </p>
                <dl className="grid gap-2 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-muted-foreground">
                      Declaration observed (UTC)
                    </dt>
                    <dd>
                      {record.declaredAt
                        ? formatTimestamp(record.declaredAt)
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Fixed deadline (UTC)
                    </dt>
                    <dd>
                      {record.deadlineAt
                        ? formatTimestamp(record.deadlineAt)
                        : "Unavailable"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      Settlement observed (UTC)
                    </dt>
                    <dd>
                      {record.settledAt
                        ? formatTimestamp(record.settledAt)
                        : "Not observed"}
                    </dd>
                  </div>
                </dl>
                {record.settlement?.event.type === "expectation_resolved" && (
                  <p className="text-sm">
                    Reported confirmation outcome:{" "}
                    <strong>
                      {record.settlement.event.outcome ?? "Not reported"}
                    </strong>
                  </p>
                )}
                {record.settlement?.event.type === "expectation_cancelled" && (
                  <p className="text-sm">
                    Cancellation: <code>{record.settlement.event.code}</code>
                  </p>
                )}
                {record.outOfOrder && (
                  <p className="text-xs text-muted-foreground">
                    Settlement was observed before the declaration. Original
                    receipt order is preserved.
                  </p>
                )}
                {record.state === "met-late" && (
                  <p className="text-xs text-muted-foreground">
                    Observed late by Flowmark. Delivery delay and clock
                    differences mean this does not prove the provider responded
                    late.
                  </p>
                )}
                <div className="flex flex-wrap gap-4 text-sm text-primary">
                  {record.declaration && (
                    <Link
                      href={`/runs/${id}?event=${record.declaration.eventId}#event-${record.declaration.eventId}`}
                    >
                      View declaration event
                    </Link>
                  )}
                  {record.settlement && (
                    <Link
                      href={`/runs/${id}?event=${record.settlement.eventId}#event-${record.settlement.eventId}`}
                    >
                      View settlement event
                    </Link>
                  )}
                </div>
                <details>
                  <summary className="cursor-pointer text-sm text-primary">
                    Recorded evidence and event references
                  </summary>
                  <div className="mt-3 grid min-w-0 gap-3">
                    <JsonData
                      value={{
                        reference: record.reference,
                        declaration: record.declaration,
                        settlement: record.settlement,
                      }}
                    />
                  </div>
                </details>
              </section>
            ))}
            <p className="text-xs leading-6 text-muted-foreground">
              Counts cover retained declared evidence. Deadlines survive process
              restarts but do not extend retention. Timing does not verify the
              reported business outcome.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
