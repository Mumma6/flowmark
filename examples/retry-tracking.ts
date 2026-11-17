import type { WorkflowRetryReference } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

interface RemainingImport {
  readonly imported: number
}

declare function importRemaining(batchId: string): Promise<RemainingImport>

/**
 * `retryOf` starts a different run with a new id. It does not continue
 * the referenced execution and it does not run the earlier work again.
 */
export async function retryImport(
  previous: WorkflowRetryReference,
  batchId: string,
): Promise<RemainingImport & { readonly runId: string }> {
  return flowmark.workflow(
    "customer.import",
    async (flow) => {
      const imported = await flow.operation("import-remaining", () =>
        importRemaining(batchId),
      )
      flow.done({
        outcome: "complete",
        result: { imported: imported.imported },
      })
      return { runId: flow.runId, imported: imported.imported }
    },
    { retryOf: previous, properties: { batchId } },
  )
}
