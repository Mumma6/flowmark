"use client"

import { dailyVolumeData } from "../chart-model"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@flowmark/ui"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { type Snapshot } from "../../platform/api-types"
import { volumeConfig } from "../chart-model"

export function DailyVolumeChart({
  daily,
  empty = "No runs in the last 30 days.",
}: {
  daily: Snapshot["daily"]
  empty?: string
}) {
  const total = daily.reduce((sum, day) => sum + day.count, 0)
  const data = dailyVolumeData(daily)
  if (total === 0) {
    return (
      <p className="px-1 py-10 text-center text-sm text-muted-foreground">
        {empty}
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
                  : `${value} · ${rate}% run completion`
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
