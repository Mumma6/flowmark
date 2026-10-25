"use client"

import { useRef, useState } from "react"
import { Schema } from "effect"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  NativeSelect,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import {
  businessScenarios,
  ExecutionSchema,
  type Area,
  type BusinessScenarioId,
  type Execution,
} from "../lib/operations-catalog"
import { ScenarioRecords } from "./scenario-records"

const areas = [
  {
    id: "invoices",
    label: "Invoices",
    title: "Import customer invoices",
    description:
      "Validate an invoice file and save accepted records. See exactly which invoices need correction.",
    action: "Import invoices",
    source: "october-invoices.csv · 5 invoices",
  },
  {
    id: "inventory",
    label: "Inventory",
    title: "Sync supplier inventory",
    description:
      "Fetch stock in pages. If a supplier stops responding, find the last saved page before retrying.",
    action: "Sync inventory",
    source: "Studio Supply · 12 products · 3 pages",
  },
  {
    id: "orders",
    label: "Orders",
    title: "Prepare an order for dispatch",
    description:
      "Reserve stock, then create a shipping label. A failed label request must not hide an existing reservation.",
    action: "Prepare order",
    source: "ORD-2048 · Birch Studio · 3 items",
  },
] as const

export function OperationsApp() {
  const [area, setArea] = useState<Area>("invoices")
  const [selected, setSelected] = useState<Record<Area, BusinessScenarioId>>({
    invoices: "invoices-rejected",
    inventory: "inventory-interrupted",
    orders: "order-carrier-down",
  })
  const [executions, setExecutions] = useState<Execution[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState("")
  const busy = useRef(false)
  const [batchComplete, setBatchComplete] = useState(false)
  const completed = executions.filter(
    (item) => item.status === "completed",
  ).length

  async function requestScenario(id: BusinessScenarioId) {
    const response = await fetch("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: id }),
    })
    if (!response.ok) {
      throw new Error(
        `Could not execute scenario (HTTP ${response.status}). Check the harness server console.`,
      )
    }
    const result = Schema.decodeUnknownSync(ExecutionSchema)(
      await response.json(),
    )
    setExecutions((current) => [result, ...current].slice(0, 30))
    return result
  }

  async function execute(id?: BusinessScenarioId) {
    if (busy.current) {
      return
    }
    busy.current = true
    setError("")
    setBatchComplete(false)
    setPending(id ?? "all")
    try {
      if (id) {
        await requestScenario(id)
      } else {
        for (const scenario of businessScenarios) {
          await requestScenario(scenario.id)
        }
        setBatchComplete(true)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  return (
    <>
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">
            Fieldwork Operations
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Everyday work. Visible outcomes.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Import invoices, update stock and prepare orders. Run a normal case
            or a failure, then follow its evidence in Flowmark.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={pending !== null}
          onClick={() => void execute()}
        >
          {pending === "all"
            ? "Running six scenarios…"
            : "Run all six scenarios"}
        </Button>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Execution could not finish</AlertTitle>
          <AlertDescription>
            {error} Previously finished scenarios are retained; a retry creates
            new runs.
          </AlertDescription>
        </Alert>
      )}
      {batchComplete && (
        <Alert>
          <AlertTitle>Six application scenarios executed</AlertTitle>
          <AlertDescription>
            Two invoice imports, two inventory syncs and two order fulfillments.
            Open the dashboard for their recorded runs; telemetry delivery may
            take a moment.
          </AlertDescription>
        </Alert>
      )}
      <section aria-label="This session" className="grid grid-cols-3 gap-3">
        {[
          ["Executed", executions.length],
          ["Completed", completed],
          ["Failed", executions.length - completed],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs text-muted-foreground">{label}</p>
              <strong className="mt-2 block text-2xl font-semibold">
                {value}
              </strong>
              <p className="mt-1 text-xs text-muted-foreground">
                This browser session
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Tabs
        value={area}
        onValueChange={(value) => {
          if (
            value === "invoices" ||
            value === "inventory" ||
            value === "orders"
          ) {
            setArea(value)
          }
        }}
      >
        <TabsList
          aria-label="Operations areas"
          className="h-auto w-full justify-start sm:w-fit"
        >
          {areas.map((item) => (
            <TabsTrigger key={item.id} value={item.id} className="px-5">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {areas.map((item) => {
          const id = selected[item.id]
          const scenario = businessScenarios.find((entry) => entry.id === id)!
          const last = executions.find((entry) => entry.scenario === id)
          return (
            <TabsContent
              key={item.id}
              value={item.id}
              className="mt-4 grid min-w-0 gap-5"
            >
              <Card>
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription className="max-w-3xl leading-7">
                    {item.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <label className="grid flex-1 gap-2 text-xs text-muted-foreground">
                      <span>Local scenario</span>
                      <NativeSelect
                        value={id}
                        disabled={pending !== null}
                        onChange={(event) => {
                          const match = businessScenarios.find(
                            (entry) =>
                              entry.id === event.target.value &&
                              entry.area === item.id,
                          )
                          if (match) {
                            setSelected((current) => ({
                              ...current,
                              [item.id]: match.id,
                            }))
                          }
                        }}
                      >
                        {businessScenarios
                          .filter((entry) => entry.area === item.id)
                          .map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.title}
                            </option>
                          ))}
                      </NativeSelect>
                    </label>
                    <Button
                      disabled={pending !== null}
                      onClick={() => void execute(id)}
                    >
                      {pending === id ? "Processing…" : item.action}
                    </Button>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm leading-7">
                    <p className="font-medium">{item.source}</p>
                    <p className="text-muted-foreground">{scenario.expected}</p>
                  </div>
                </CardContent>
                <ScenarioRecords
                  area={item.id}
                  scenario={id}
                  execution={last}
                />
              </Card>
              {last && (
                <Card>
                  <CardHeader>
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <Badge
                        variant={
                          last.status === "failed" ? "destructive" : "success"
                        }
                      >
                        {last.status === "failed" ? "Failed" : "Completed"}
                      </Badge>
                      <code className="text-xs text-muted-foreground">
                        {last.reference}
                      </code>
                    </div>
                    <CardTitle>{last.summary}</CardTitle>
                    <CardDescription className="max-w-3xl leading-7">
                      {last.nextAction}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    <Button asChild size="sm">
                      <a
                        href={`http://localhost:3001/workflows/${encodeURIComponent(last.workflow)}?search=${encodeURIComponent(last.runId)}`}
                      >
                        Inspect this execution ↗
                      </a>
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      SDK run ID <code className="break-all">{last.runId}</code>
                    </span>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )
        })}
      </Tabs>
      <Card>
        <CardHeader>
          <CardTitle>Recent local executions</CardTitle>
          <CardDescription>
            Last 30 in this browser session. Flowmark keeps the recorded
            history.
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead>Application result</TableHead>
              <TableHead>Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executions.map((item) => (
              <TableRow key={item.runId}>
                <TableCell className="font-medium">{item.workflow}</TableCell>
                <TableCell className="font-mono text-xs">
                  {item.reference}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      item.status === "failed" ? "destructive" : "success"
                    }
                  >
                    {item.status === "failed" ? "Failed" : "Completed"}
                  </Badge>
                </TableCell>
                <TableCell className="min-w-48 text-xs">
                  {item.summary}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={`http://localhost:3001/workflows/${encodeURIComponent(item.workflow)}?search=${encodeURIComponent(item.runId)}`}
                    >
                      View execution ↗
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {executions.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No executions this session. Choose an operation above or run
                  all six scenarios.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}
