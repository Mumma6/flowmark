import { flowmark } from "./flowmark"

interface ImportResult {
  readonly imported: number
  readonly skipped: number
  readonly rejected: number
}

interface CustomerRow {
  readonly email: string
}

declare function loadCustomerBatch(batchId: string): Promise<{
  readonly rows: readonly CustomerRow[]
}>

declare function isValidCustomer(row: CustomerRow): boolean
declare function upsertCustomer(row: CustomerRow): Promise<void>

const customerImport = flowmark.defineWorkflow<
  { batchId: string; source: string; definitionRevision: string },
  ImportResult,
  "complete" | "partial"
>("customer.import")

/**
 * Typed definitions emit nothing until `start()`. The type arguments are
 * erased at runtime and do not register a dashboard declaration.
 * `properties.definitionRevision` selects a presentation revision the
 * server already knows about.
 */
export async function importCustomers(batchId: string): Promise<ImportResult> {
  const flow = customerImport.start({
    properties: {
      batchId,
      source: "salesforce",
      definitionRevision: "customer-import-v3",
    },
  })

  try {
    const batch = await loadCustomerBatch(batchId)
    let imported = 0
    let skipped = 0
    let rejected = 0

    flow.step("batch-loaded", { properties: { rows: batch.rows.length } })

    for (const row of batch.rows) {
      if (!isValidCustomer(row)) {
        rejected += 1
        continue
      }
      try {
        await upsertCustomer(row)
        imported += 1
      } catch {
        skipped += 1
      }
    }

    const result = { imported, skipped, rejected }
    flow.done({
      outcome: rejected === 0 && skipped === 0 ? "complete" : "partial",
      result,
    })
    return result
  } catch (cause) {
    flow.fail({ code: "CUSTOMER_IMPORT_FAILED" })
    throw cause
  }
}
