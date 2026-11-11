"use client"

import { failureCodeData, chartHeight } from "../chart-model"

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@flowmark/ui"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { type Snapshot } from "../../platform/api-types"
import { failureConfig } from "../chart-model"

export function FailureCodeChart({
  codes,
}: {
  codes: Snapshot["failureCodes"]
}) {
  const data = failureCodeData(codes)
  const heightClass = chartHeight(data.length)
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
        <XAxis
          type="number"
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
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
