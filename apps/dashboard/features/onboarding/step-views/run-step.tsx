"use client"
import { Button } from "@flowmark/ui"
import { Check, Radio } from "lucide-react"
import { DataState } from "../../shared/dashboard-components"
import type { useOnboarding } from "../use-onboarding"
export function RunStep({
  snapshot,
  hasRuns,
  onInvestigate,
  disabled,
}: Pick<ReturnType<typeof useOnboarding>, "snapshot" | "hasRuns"> & {
  readonly onInvestigate: () => void
  readonly disabled: boolean
}) {
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
              ? `${snapshot.data?.metrics.totalRuns.toLocaleString()} ${snapshot.data?.metrics.totalRuns === 1 ? "execution" : "executions"} recorded. In Explore, select your process and open an execution to see its reported result.`
              : "Run the process in your application. Evidence appears after the API receives it. You can finish setup now and return when it arrives."}
          </p>
          {hasRuns ? (
            <ol className="mt-4 grid list-decimal gap-2 pl-5 text-xs leading-6 text-muted-foreground">
              <li>Select the process to see its execution history.</li>
              <li>
                Open an execution: Outcome shows reported results; Timeline
                shows operations and failures.
              </li>
              <li>Check the reported result for skipped or rejected work.</li>
            </ol>
          ) : null}
          {hasRuns ? (
            <div className="mt-4 grid gap-3">
              <p className="text-xs leading-6 text-muted-foreground">
                Your first run is here. Connect Cursor to investigate it.
              </p>
              <Button
                type="button"
                variant="outline"
                className="justify-self-start"
                disabled={disabled}
                onClick={onInvestigate}
              >
                Connect Cursor
              </Button>
            </div>
          ) : null}
          {!hasRuns && (
            <Button
              type="button"
              variant="outline"
              className="mt-4"
              disabled={snapshot.isFetching}
              onClick={() => void snapshot.refetch()}
            >
              {snapshot.isFetching ? "Checking…" : "Check for runs"}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  )
}
