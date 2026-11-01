import { createFlowmark } from "@flowmarkdev/node"

interface PriceRow {
  readonly sku: string
  readonly amount: number
}

declare function readPriceRows(fileId: string): Promise<readonly PriceRow[]>
declare function upsertPrice(row: PriceRow): Promise<void>

/**
 * `progress: "latest"` replaces adjacent unsent progress for one handle.
 * Each snapshot is absolute: `completed` is the count so far, not a delta.
 * Shut the client down from the process entrypoint before exit.
 */
const flowmark = createFlowmark({
  delivery: { progress: "latest" },
})

export async function importPrices(fileId: string): Promise<number> {
  const flow = flowmark.workflow("catalog.price-import", {
    properties: { fileId },
  })
  const rows = await readPriceRows(fileId)
  let completed = 0

  try {
    for (const row of rows) {
      await upsertPrice(row)
      completed += 1
      flow.progress({ completed, total: rows.length, unit: "prices" })
    }
    flow.done({ outcome: "complete", result: { updated: completed } })
    return completed
  } catch (cause) {
    flow.fail({
      code: "PRICE_IMPORT_FAILED",
      outcome: "partial",
      result: { updated: completed },
    })
    throw cause
  }
}
