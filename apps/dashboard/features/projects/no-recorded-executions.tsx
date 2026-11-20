import { Card } from "@flowmark/ui"
import { ViewLink } from "../shared/dashboard-components"

/** Absence of execution evidence makes no claim about installation or deployment. */
export function NoRecordedExecutions() {
  return (
    <Card className="grid justify-items-center gap-3 border-dashed px-6 py-16 text-center shadow-none sm:py-24">
      <h2 className="text-base font-medium">No recorded executions</h2>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        Start with one process, such as an invoice import. Run the instrumented
        path once or wait for normal application traffic. You can close Studio
        and return later.
      </p>
      <ViewLink href="/onboarding?mode=guide&step=instrument">
        Setup instructions
      </ViewLink>
      <p className="max-w-sm text-sm text-muted-foreground">
        If a run is missing, check the project write key, API origin and SDK
        delivery diagnostics.
      </p>
    </Card>
  )
}
