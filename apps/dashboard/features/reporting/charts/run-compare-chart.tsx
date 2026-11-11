"use client"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@flowmark/ui"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"
import { formatDuration } from "../../shared/format"
import { compareConfig, axisDuration } from "../chart-model"

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
