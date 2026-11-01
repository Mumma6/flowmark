import type { WorkflowDefinition, WorkflowOutcome } from "@flowmarkdev/node"
import { flowmark } from "./flowmark"

interface CustomerImportContext {
  readonly batchId: string
  readonly source: string
  readonly definitionRevision: string
  readonly fileName?: string
}

interface CustomerImportResult {
  readonly imported: number
  readonly skipped: number
  readonly rejected: number
}

type CustomerImportOutcome = "complete" | "partial"

interface CustomerBatch {
  readonly fileName: string
  readonly rows: readonly { readonly email: string }[]
}

declare function loadCustomerBatch(batchId: string): Promise<CustomerBatch>
declare function isValidCustomer(email: string): boolean
declare function upsertCustomer(email: string): Promise<void>

/**
 * Context, result, and outcome are the three type arguments. Creating the
 * definition emits nothing. `start` requires the context, `report` and
 * `setProperties` accept a partial update, and `done` / `fail` accept the
 * result and one of the declared outcomes.
 */
const customerImport: WorkflowDefinition<
  CustomerImportContext,
  CustomerImportResult,
  CustomerImportOutcome
> = flowmark.defineWorkflow<
  CustomerImportContext,
  CustomerImportResult,
  CustomerImportOutcome
>("customer.import")

export async function importCustomers(
  batchId: string,
): Promise<CustomerImportResult> {
  const flow = customerImport.start({
    properties: {
      batchId,
      source: "salesforce",
      definitionRevision: "customer-import-v3",
    },
    environment: "production",
    release: "imports-v3",
  })
  let imported = 0
  let skipped = 0
  let rejected = 0

  try {
    const batch = await loadCustomerBatch(batchId)
    flow.setProperties({ fileName: batch.fileName })
    flow.step("batch-loaded", { properties: { rows: batch.rows.length } })

    for (const row of batch.rows) {
      if (!isValidCustomer(row.email)) {
        rejected += 1
        continue
      }
      try {
        await upsertCustomer(row.email)
        imported += 1
      } catch {
        skipped += 1
      }
      flow.report({ imported, skipped, rejected })
    }

    const result = { imported, skipped, rejected }
    const outcome = (
      rejected === 0 && skipped === 0 ? "complete" : "partial"
    ) satisfies WorkflowOutcome
    flow.done({ outcome, result })
    return result
  } catch (cause) {
    flow.fail({
      code: "CUSTOMER_IMPORT_FAILED",
      message: "The import stopped before every row was handled",
      retryable: true,
      outcome: "partial",
      result: { imported, skipped, rejected },
    })
    throw cause
  }
}
