"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import {
  formatDuration,
  groupBy,
  paginate,
  workflowFamily,
  type WorkflowSummary,
} from "./dashboard-data"
import { FilterSelect, TablePagination } from "./dashboard-components"

export function WorkflowDirectory({
  workflows,
}: {
  workflows: readonly WorkflowSummary[]
}) {
  const [search, setSearch] = useState("")
  const [source, setSource] = useState("all")
  const [sort, setSort] = useState("name")
  const [page, setPage] = useState(1)
  const matching = workflows
    .filter(
      (item) =>
        item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        (source === "all" ||
          (source === "browser"
            ? item.name.startsWith("browser.")
            : !item.name.startsWith("browser."))),
    )
    .sort((a, b) =>
      sort === "volume"
        ? b.runs - a.runs || a.name.localeCompare(b.name)
        : workflowFamily(a.name).localeCompare(workflowFamily(b.name)) ||
          a.name.localeCompare(b.name),
    )
  const result = paginate(matching, page, 12)
  return (
    <Card className="overflow-hidden shadow-none">
      <div className="flex flex-wrap items-end gap-3 border-b border-border/60 bg-muted/20 p-5">
        <label className="grid min-w-0 flex-[1_1_240px] gap-2 text-xs text-muted-foreground sm:max-w-[360px]">
          <span>Search workflows</span>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-2.5"
            />
            <Input
              className="pl-8"
              type="search"
              placeholder="Find a workflow…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>
        </label>
        <FilterSelect
          label="Namespace"
          value={source}
          onChange={(value) => {
            setSource(value)
            setPage(1)
          }}
          options={[
            { value: "all", label: "All namespaces" },
            { value: "server", label: "Application" },
            { value: "browser", label: "Browser" },
          ]}
        />
        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(value) => {
            setSort(value)
            setPage(1)
          }}
          options={[
            { value: "name", label: "Name groups" },
            { value: "volume", label: "Most runs" },
          ]}
        />
      </div>
      <p className="px-5 py-3 text-xs leading-6 text-muted-foreground">
        All recorded runs · completion rate is among finished runs. Namespace
        follows the workflow name, not verified provenance.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Workflow</TableHead>
            <TableHead>Namespace</TableHead>
            <TableHead className="text-right">Recorded runs</TableHead>
            <TableHead
              className="text-right"
              title="Completed among finished runs"
            >
              Run completion
            </TableHead>
            <TableHead className="text-right">Median</TableHead>
            <TableHead className="text-right">p95</TableHead>
            <TableHead>
              <span className="sr-only">View workflow</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        {groupBy(result.items, (workflow) => workflowFamily(workflow.name)).map(
          ([family, items]) => {
            const familyCount = matching.filter(
              (item) => workflowFamily(item.name) === family,
            ).length
            return (
              <TableBody key={family}>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead
                    colSpan={7}
                    scope="rowgroup"
                    className="h-10 border-y border-border px-4 text-xs font-medium text-foreground"
                  >
                    {family}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {familyCount} workflow{familyCount === 1 ? "" : "s"}
                    </span>
                  </TableHead>
                </TableRow>
                {items.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell>
                      <Link
                        className="font-medium hover:text-primary hover:underline"
                        href={`/workflows/${encodeURIComponent(item.name)}`}
                      >
                        {item.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.name.startsWith("browser.")
                          ? "Browser"
                          : "Application"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.runs.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {item.successRate == null
                        ? "No finished runs"
                        : `${item.successRate}%`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {formatDuration(item.medianDurationMs)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-muted-foreground">
                      {formatDuration(item.p95DurationMs)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link
                          href={`/workflows/${encodeURIComponent(item.name)}`}
                          aria-label={`View ${item.name}`}
                        >
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            )
          },
        )}
      </Table>
      {result.total === 0 && (
        <p className="px-5 py-8 text-center text-sm leading-7 text-muted-foreground">
          {workflows.length === 0
            ? "No workflows recorded. Start a run with the SDK to create one."
            : "No workflows match these filters."}
        </p>
      )}
      <TablePagination {...result} onPageChange={setPage} />
    </Card>
  )
}
