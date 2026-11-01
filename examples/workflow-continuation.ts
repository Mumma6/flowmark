import type { WorkflowRunReference } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

/**
 * Persist `runId` and continue with the same workflow name. Leave the run
 * open until the whole process is finished. A later start ignores a second
 * copy of the original properties, environment, and release.
 */
export function startApplication(applicationId: string): WorkflowRunReference {
  const flow = flowmark.workflow("onboarding.application", {
    properties: { applicationId },
  })
  flow.step("draft-saved")
  return { workflow: "onboarding.application", runId: flow.runId }
}

export function finishApplication(
  reference: WorkflowRunReference,
  approved: boolean,
): void {
  const flow = flowmark.workflow(reference.workflow, { id: reference.runId })
  flow.setProperties({ reviewComplete: true })

  if (!approved) {
    flow.fail({
      code: "APPLICATION_REJECTED",
      outcome: "rejected",
      result: { approved: false },
    })
    return
  }

  flow.step("review-approved")
  flow.done({ outcome: "approved", result: { approved: true } })
}
