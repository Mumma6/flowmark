import { flowmark } from "./flowmark"

interface ImportProgress {
  readonly imported: number
  readonly rejected: number
  readonly skipped?: number
}

declare function importCustomerPage(
  batchId: string,
  page: number,
): Promise<ImportProgress>

/**
 * `report` replaces the whole non-final snapshot. Fields omitted from the
 * latest report become unknown. The report is not the final result and
 * does not set the business outcome.
 */
export async function importCustomersByPage(batchId: string): Promise<void> {
  const flow = flowmark.workflow("customer.import", {
    properties: { batchId },
  })
  let imported = 0
  let rejected = 0
  let skipped = 0

  try {
    for (let page = 1; page <= 3; page += 1) {
      const pageResult = await flow.operation(
        "import-page",
        () => importCustomerPage(batchId, page),
        { properties: { page } },
      )
      imported += pageResult.imported
      rejected += pageResult.rejected
      skipped += pageResult.skipped ?? 0
      flow.report({ imported, rejected, skipped })
    }

    flow.report({ imported, rejected })
    flow.done({
      outcome: rejected === 0 ? "complete" : "partial",
      result: { imported, rejected, skipped },
    })
  } catch (cause) {
    flow.fail({
      code: "IMPORT_PAGE_FAILED",
      outcome: "partial",
      result: { imported, rejected, skipped },
    })
    throw cause
  }
}
