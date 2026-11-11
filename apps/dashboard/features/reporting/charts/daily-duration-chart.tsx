"use client"

import { dailyDurationData } from "../chart-model"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@flowmark/ui"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { type Snapshot } from "../../platform/api-types"
import { formatDuration } from "../../shared/format"
import { durationConfig, axisDuration } from "../chart-model"

export function DailyDurationChart({ daily }: { daily: Snapshot["daily"] }) {
  const data = dailyDurationData(daily)
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
          strokeDasharray="5 4"
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
