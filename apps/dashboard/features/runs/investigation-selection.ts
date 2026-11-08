import { decodeRunInvestigationSelection } from "@flowmarkdev/core"

/** Studio's internal route run id, never the application's external SDK run id. */
export const studioRunSelection = (projectId: string, runId: string) =>
  decodeRunInvestigationSelection({
    version: 1,
    kind: "run",
    projectId,
    runId,
    section: "events",
  })

export { runSelectionToolInput } from "@flowmarkdev/core"
