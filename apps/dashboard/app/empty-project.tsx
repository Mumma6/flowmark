import { GettingStartedChecklist } from "./getting-started"

/** Empty project surface — same checklist as onboarding. */
export function EmptyProject() {
  return <GettingStartedChecklist hasRuns={false} />
}
