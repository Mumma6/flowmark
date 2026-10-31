"use client"

import { Fragment, useState } from "react"
import type { inferRouterOutputs } from "@trpc/server"
import type { AppRouter } from "@flowmark/server/trpc"
import {
  Badge,
  Button,
  CodeBlock,
  CodeBlockContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import { ChevronDown, ChevronRight } from "lucide-react"
import { FilterSelect, TablePagination } from "./dashboard-components"
import { formatDuration, formatTimestamp, paginate } from "./dashboard-data"

export type RunEvent = inferRouterOutputs<AppRouter>["run"]["detail"][number]

export function JsonData({ value }: { value: unknown }) {
  return (
    <CodeBlock>
      <CodeBlockContent className="max-h-96 text-xs leading-7 text-[#dde9df]">
        {JSON.stringify(value, null, 2)}
      </CodeBlockContent>
    </CodeBlock>
  )
}

export function eventLabel(event: RunEvent) {
  switch (event.type) {
    case "started":
      return "Run started"
    case "step":
      return event.step ?? "Checkpoint"
    case "properties":
      return "Context updated"
    case "error":
      return event.error && "handled" in event.error && event.error.handled
        ? "Handled error"
        : "Error observed"
    case "report":
      return "Business snapshot reported (non-final)"
    case "progress":
      return "Progress reported"
    case "completed":
      return "Run completed"
    case "failed":
      return "Run failed"
    case "operation_started":
      return `Started · ${event.operationName ?? "Operation"}`
    case "operation_completed":
      return `Completed · ${event.operationName ?? "Operation"}`
    case "operation_failed":
      return `Failed · ${event.operationName ?? "Operation"}`
    default:
      return event.type
  }
}

export function EventTable({
  events,
  initialEventId,
}: {
  events: readonly RunEvent[]
  initialEventId?: string
}) {
  const [type, setType] = useState("all")
  const [page, setPage] = useState(() =>
    initialEventId
      ? Math.floor(
          Math.max(
            0,
            events.findIndex((event) => event.id === initialEventId),
          ) / 15,
        ) + 1
      : 1,
  )
  const [expanded, setExpanded] = useState<string | null>(
    initialEventId ?? null,
  )
  const matching = events.filter(
    (event) =>
      type === "all" ||
      (type === "operations"
        ? event.type.startsWith("operation_")
        : type === "errors"
          ? event.type === "error" ||
            event.type === "failed" ||
            event.type === "operation_failed"
          : event.type === type),
  )
  const result = paginate(matching, page, 15)
  const start = events[0] ? new Date(events[0].timestamp).getTime() : 0
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 p-5">
        <FilterSelect
          label="Event type"
          value={type}
          onChange={(value) => {
            setType(value)
            setPage(1)
          }}
          options={[
            { value: "all", label: "All events" },
            { value: "step", label: "Checkpoints" },
            { value: "operations", label: "Operations" },
            { value: "progress", label: "Progress" },
            { value: "report", label: "Business snapshots" },
            { value: "errors", label: "Errors and failures" },
            { value: "properties", label: "Context updates" },
          ]}
        />
        <p className="text-xs leading-6 text-muted-foreground">
          Event-time order · expand a row for recorded payloads.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Details</TableHead>
            <TableHead>Elapsed</TableHead>
            <TableHead>Occurred (UTC)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.items.map((event) => (
            <Fragment key={event.id}>
              <TableRow>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-expanded={expanded === event.id}
                    aria-controls={`event-${event.id}`}
                    onClick={() =>
                      setExpanded(expanded === event.id ? null : event.id)
                    }
                  >
                    {expanded === event.id ? (
                      <ChevronDown aria-hidden="true" />
                    ) : (
                      <ChevronRight aria-hidden="true" />
                    )}
                    {eventLabel(event)}
                  </Button>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {event.outcome != null && (
                      <p className="text-sm">
                        Business outcome: {event.outcome}
                      </p>
                    )}
                    {event.error && (
                      <Badge variant="destructive">{event.error.code}</Badge>
                    )}
                    {event.type === "progress" && event.completed != null && (
                      <span>
                        {event.completed}
                        {event.total != null ? ` / ${event.total}` : ""}{" "}
                        {event.unit}
                      </span>
                    )}
                    {event.durationMs != null && (
                      <span>{formatDuration(event.durationMs)}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  +
                  {(
                    (new Date(event.timestamp).getTime() - start) /
                    1000
                  ).toFixed(3)}{" "}
                  s
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatTimestamp(event.timestamp)}
                </TableCell>
              </TableRow>
              <TableRow id={`event-${event.id}`} hidden={expanded !== event.id}>
                <TableCell colSpan={4}>
                  <dl className="mb-5 grid gap-4 text-xs sm:grid-cols-2 [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
                    <div>
                      <dt>Event type</dt>
                      <dd>{event.type}</dd>
                    </div>
                    {event.operationId && (
                      <div>
                        <dt>Operation ID</dt>
                        <dd>
                          <code>{event.operationId}</code>
                        </dd>
                      </div>
                    )}
                    {event.receivedAt && (
                      <div>
                        <dt>Received (UTC)</dt>
                        <dd>{formatTimestamp(event.receivedAt)}</dd>
                      </div>
                    )}
                  </dl>
                  {event.attempt && (
                    <JsonData value={{ attempt: event.attempt }} />
                  )}
                  {event.error && <JsonData value={event.error} />}
                  {!event.error && event.reason && <p>{event.reason}</p>}
                  {event.properties && (
                    <div>
                      <h3 className="mb-3 mt-4 text-sm font-semibold">
                        Recorded properties
                      </h3>
                      <JsonData value={event.properties} />
                    </div>
                  )}
                  {event.result != null && (
                    <div>
                      <h3 className="mb-3 mt-4 text-sm font-semibold">
                        Recorded result
                      </h3>
                      <JsonData value={event.result} />
                    </div>
                  )}
                  {!event.error &&
                    !event.properties &&
                    !event.result &&
                    !event.reason &&
                    !event.outcome &&
                    !event.attempt && (
                      <p className="text-xs leading-6 text-muted-foreground">
                        No additional payload recorded.
                      </p>
                    )}
                </TableCell>
              </TableRow>
            </Fragment>
          ))}
          {result.total === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className="px-5 py-8 text-center text-sm text-muted-foreground"
              >
                No events of this type.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination {...result} onPageChange={setPage} />
    </div>
  )
}
