import { Button } from "@flowmark/ui"
import { formatDuration, formatTimestamp } from "../../shared/format"
import type { useOnboarding } from "../use-onboarding"

export function RecordedRunCheck({
  run,
  checking,
  failed,
  check,
}: {
  readonly run: ReturnType<typeof useOnboarding>["recordedRun"]
  readonly checking: boolean
  readonly failed: boolean
  readonly check: () => void
}) {
  return (
    <section
      aria-labelledby="onboarding-recorded-run"
      className="grid gap-3 rounded-lg border border-border p-4"
    >
      <h3 id="onboarding-recorded-run" className="text-sm font-medium">
        Check for a recorded run
      </h3>
      {checking ? (
        <p role="status" className="text-sm text-muted-foreground">
          Checking this project…
        </p>
      ) : failed ? (
        <p role="alert" className="text-sm text-muted-foreground">
          Could not check this project. Retry the check or open Studio.
        </p>
      ) : run ? (
        <p role="status" className="break-words text-sm text-muted-foreground">
          {run.workflow} ·{" "}
          {run.status === "Running" ? "No final outcome" : run.status} ·{" "}
          {formatDuration(run.durationMs)} ·{" "}
          <time dateTime={run.startedAt}>
            {formatTimestamp(run.startedAt)} UTC
          </time>
        </p>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          No server run recorded yet. Run the instrumented path, then check
          again. If it still does not appear, check the server write key, API
          origin and SDK delivery diagnostics.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        disabled={checking}
        onClick={check}
      >
        {failed ? "Retry check" : "Check for a run"}
      </Button>
    </section>
  )
}
