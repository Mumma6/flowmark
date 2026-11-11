"use client"
import { Check, Radio } from "lucide-react"
import { DataState } from "../../shared/dashboard-components"
import type { useOnboarding } from "../use-onboarding"
export function RunStep({
  snapshot,
  hasRuns,
}: Pick<ReturnType<typeof useOnboarding>, "snapshot" | "hasRuns">) {
  return (
    <div className="grid gap-4">
      <DataState
        pending={snapshot.isPending}
        error={snapshot.error}
        retry={() => void snapshot.refetch()}
      />
      {!snapshot.isPending && !snapshot.error ? (
        <div
          className={`rounded-xl border p-5 sm:p-6 ${hasRuns ? "border-primary/25 bg-primary/5" : "border-border bg-background/40"}`}
        >
          <span className="mb-4 grid size-10 place-items-center rounded-full border border-border">
            {hasRuns ? (
              <Check aria-hidden="true" className="size-4 text-primary" />
            ) : (
              <Radio
                aria-hidden="true"
                className="size-4 text-muted-foreground"
              />
            )}
          </span>
          <h3 className="text-base font-medium">
            {hasRuns
              ? "Your application is reporting evidence."
              : "Ready for your first execution."}
          </h3>
          <p className="mt-3 text-xs leading-7 text-muted-foreground">
            {hasRuns
              ? `${snapshot.data?.metrics.totalRuns.toLocaleString()} runs recorded in this project. Open Studio to explore the supporting evidence.`
              : "Run the process in your application. Evidence appears after the API receives it. You can finish setup now and return when it arrives."}
          </p>
        </div>
      ) : null}
    </div>
  )
}
