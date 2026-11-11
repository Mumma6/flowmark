"use client"

import { operationDurationData, chartHeight } from "../chart-model"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@flowmark/ui"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { type Snapshot } from "../../platform/api-types"
import { formatDuration } from "../../shared/format"
import { operationConfig, axisDuration } from "../chart-model"

export function OperationDurationChart({
  operations,
}: {
  operations: Snapshot["operations"]
}) {
  const data = operationDurationData(operations)
  const heightClass = chartHeight(data.length)
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
