"use client"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@flowmark/ui"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { formatDuration, type Snapshot } from "./dashboard-data"

const volumeConfig = {
  completed: {
    label: "Completed",
    color: "hsl(var(--chart-1))",
  },
  failed: {
    label: "Failed",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

const durationConfig = {
  median: {
    label: "Median",
    color: "hsl(var(--chart-1))",
  },
  p95: {
    label: "p95",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

const operationConfig = {
  duration: {
    label: "Total time",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig

const failureConfig = {
  count: {
    label: "Failed runs",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

const compareConfig = {
  current: {
    label: "This run",
    color: "hsl(var(--chart-1))",
  },
  median: {
    label: "Peer median",
    color: "hsl(var(--chart-2))",
  },
  p95: {
    label: "Peer p95",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig

function axisDuration(value: number) {
  return value < 1000
    ? `${Math.round(value)}ms`
    : `${(value / 1000).toFixed(1)}s`
}

function shortLabel(value: string, max = 20) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function DailyVolumeChart({ daily }: { daily: Snapshot["daily"] }) {
  const total = daily.reduce((sum, day) => sum + day.count, 0)
  const data = daily.map((day) => ({
    date: day.date,
    completed: day.completed,
    failed: day.failed,
    successRate: day.successRate,
  }))
  if (total === 0) {
    return (
      <p className="px-1 py-10 text-center text-sm text-muted-foreground">
        No runs in the last 30 days.
      </p>
    )
  }
  return (
    <ChartContainer
      config={volumeConfig}
      className="aspect-auto h-[240px] w-full"
    >
      <BarChart accessibilityLayer data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={20}
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="dot"
              labelFormatter={(value, payload) => {
                const rate = payload[0]?.payload?.successRate
                return rate == null
                  ? String(value ?? "")
                  : `${value} · ${rate}% success`
              }}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="completed"
          stackId="volume"
          fill="var(--color-completed)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="failed"
          stackId="volume"
          fill="var(--color-failed)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}

export function DailyDurationChart({ daily }: { daily: Snapshot["daily"] }) {
  const data = daily.map((day) => ({
    date: day.date,
    median: day.medianDurationMs,
    p95: day.p95DurationMs,
  }))
  if (data.every((day) => day.median == null && day.p95 == null)) {
    return (
      <p className="px-1 py-10 text-center text-sm text-muted-foreground">
        No finished-run durations yet.
      </p>
    )
  }
  return (
    <ChartContainer
      config={durationConfig}
      className="aspect-auto h-[240px] w-full"
    >
      <LineChart accessibilityLayer data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={20}
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => axisDuration(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(value, name) => (
                <div className="flex flex-1 items-center justify-between gap-4">
                  <span className="text-muted-foreground">
                    {name === "median" ? "Median" : "p95"}
                  </span>
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {typeof value === "number"
                      ? formatDuration(value)
                      : String(value ?? "—")}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          dataKey="median"
          type="monotone"
          stroke="var(--color-median)"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          dataKey="p95"
          type="monotone"
          stroke="var(--color-p95)"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ChartContainer>
  )
}

export function OperationDurationChart({
  operations,
}: {
  operations: Snapshot["operations"]
}) {
  const data = operations.slice(0, 8).map((item) => ({
    label: shortLabel(item.name),
    duration: item.totalDurationMs,
    name: item.name,
    workflow: item.workflow,
  }))
  const heightClass =
    data.length <= 1
      ? "h-[140px]"
      : data.length <= 3
        ? "h-[200px]"
        : "h-[240px]"
  return (
    <ChartContainer
      config={operationConfig}
      className={`aspect-auto w-full ${heightClass}`}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 16 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => axisDuration(value)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={156}
          tickMargin={4}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <div className="grid gap-1">
                  <span className="font-medium text-foreground">
                    {item.payload?.name}
                  </span>
                  <span className="text-muted-foreground">
                    {item.payload?.workflow}
                  </span>
                  <span className="font-mono font-medium tabular-nums">
                    {typeof value === "number"
                      ? formatDuration(value)
                      : String(value ?? "—")}{" "}
                    total
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar
          dataKey="duration"
          fill="var(--color-duration)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  )
}

export function FailureCodeChart({
  codes,
}: {
  codes: Snapshot["failureCodes"]
}) {
  const data = codes.slice(0, 8).map((item) => ({
    label: shortLabel(item.code),
    count: item.count,
    code: item.code,
    workflow: item.workflow,
  }))
  const heightClass =
    data.length <= 1
      ? "h-[140px]"
      : data.length <= 3
        ? "h-[200px]"
        : "h-[240px]"
  return (
    <ChartContainer
      config={failureConfig}
      className={`aspect-auto w-full ${heightClass}`}
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 16 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={156}
          tickMargin={4}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              formatter={(value, _name, item) => (
                <div className="grid gap-1">
                  <span className="font-mono font-medium text-foreground">
                    {item.payload?.code}
                  </span>
                  <span className="text-muted-foreground">
                    {item.payload?.workflow}
                  </span>
                  <span className="font-mono tabular-nums">
                    {typeof value === "number"
                      ? value.toLocaleString()
                      : String(value ?? "—")}{" "}
                    runs
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

export function RunCompareChart({
  currentMs,
  peerMedianMs,
  peerP95Ms,
}: {
  currentMs: number | null
  peerMedianMs: number | null
  peerP95Ms: number | null
}) {
  if (currentMs == null && peerMedianMs == null && peerP95Ms == null) {
    return null
  }
  const data = [
    {
      key: "current",
      label: "This run",
      duration: currentMs ?? 0,
      fill: "var(--color-current)",
    },
    {
      key: "median",
      label: "Peer median",
      duration: peerMedianMs ?? 0,
      fill: "var(--color-median)",
    },
    {
      key: "p95",
      label: "Peer p95",
      duration: peerP95Ms ?? 0,
      fill: "var(--color-p95)",
    },
  ]
  return (
    <ChartContainer
      config={compareConfig}
      className="aspect-auto h-[180px] w-full"
    >
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 16 }}
      >
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => axisDuration(value)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideLabel
              nameKey="key"
              formatter={(value) => (
                <div className="flex flex-1 items-center justify-between gap-4">
                  <span className="text-muted-foreground">Duration</span>
                  <span className="font-mono font-medium tabular-nums">
                    {typeof value === "number"
                      ? formatDuration(value)
                      : String(value ?? "—")}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
          {data.map((item) => (
            <Cell key={item.key} fill={item.fill} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
