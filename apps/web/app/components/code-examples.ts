export interface RunPreviewData {
  readonly name: string
  readonly status: "Completed" | "Failed"
  readonly headline: string
  readonly explanation: string
  readonly duration: string
  readonly metrics: ReadonlyArray<{ label: string; value: string }>
  readonly events: ReadonlyArray<{
    id: string
    title: string
    summary: string
    detail: string
    kind: "step" | "done" | "error"
  }>
}

interface CodeExample {
  readonly id: string
  readonly label: string
  readonly question: string
  readonly description: string
  readonly title: string
  readonly existingCode: string
  readonly code: string
  readonly preview: RunPreviewData
}

export const examples: ReadonlyArray<CodeExample> = [
  {
    id: "import",
    label: "Invoice import",
    question: "The import finished. Did every invoice make it?",
    description:
      "Your importer already validates and saves invoices. Report its result so support can see the skipped records without asking an engineer to reconstruct the run.",
    title: "jobs/import-invoices.ts",
    existingCode: `async function importInvoices(batchId: string) {
  try {
    const invoices = await loadInvoices(batchId)
    const result = await saveValidInvoices(invoices)
    return result
  } catch (error) {
    logger.error({ batchId, error }, "Import failed")
    throw error
  }
}`,
    code: `async function importInvoices(batchId: string) {
  const run = flowmark.workflow("invoice.import", { properties: { batchId } })
  try {
    const invoices = await loadInvoices(batchId)
    run.step("source-loaded", { properties: { count: invoices.length } })
    const result = await saveValidInvoices(invoices)
    run.done({ result })
    return result
  } catch (error) {
    run.fail({ code: "IMPORT_FAILED" })
    logger.error({ batchId, error }, "Import failed")
    throw error
  }
}`,
    preview: {
      name: "invoice.import",
      status: "Completed",
      headline: "988 imported. 12 need attention.",
      explanation: "The run completed, but not every invoice was accepted.",
      duration: "2.4 s",
      metrics: [
        { label: "Source invoices", value: "1,000" },
        { label: "Imported", value: "988" },
        { label: "Skipped", value: "12" },
      ],
      events: [
        {
          id: "source",
          title: "Source loaded",
          summary: "1,000 invoices received",
          detail:
            "The source-loaded checkpoint reported count: 1000. This confirms what the application received, not what was saved.",
          kind: "step",
        },
        {
          id: "result",
          title: "Import completed",
          summary: "988 imported · 12 skipped",
          detail:
            "saveValidInvoices returned { imported: 988, skipped: 12 }. The application attached that result to this run. No per-invoice rejection reasons were recorded by this instrumentation.",
          kind: "done",
        },
      ],
    },
  },
  {
    id: "sync",
    label: "Inventory sync",
    question: "The supplier is unavailable. How far did the sync get?",
    description:
      "Keep your existing page-by-page sync and error handling. Add absolute progress snapshots to leave a useful trail when a supplier request fails.",
    title: "jobs/sync-inventory.ts",
    existingCode: `async function syncInventory(supplierId: string) {
  try {
    const total = await countProducts(supplierId)
    for await (const page of fetchProductPages(supplierId)) {
      await updateStock(page)
    }
  } catch (error) {
    logger.error({ supplierId, error }, "Sync failed")
    throw error
  }
}`,
    code: `async function syncInventory(supplierId: string) {
  const run = flowmark.workflow("inventory.sync", { properties: { supplierId } })
  try {
    const total = await countProducts(supplierId)
    let updated = 0
    for await (const page of fetchProductPages(supplierId)) {
      await updateStock(page)
      updated += page.length
      run.progress({ completed: updated, total, unit: "products" })
    }
    run.done({ result: { updated } })
  } catch (error) {
    run.fail({ code: "SUPPLIER_SYNC_FAILED" })
    logger.error({ supplierId, error }, "Sync failed")
    throw error
  }
}`,
    preview: {
      name: "inventory.sync",
      status: "Failed",
      headline: "Last reported: 600 of 1,000 products.",
      explanation:
        "The sync failed. Do not assume the remaining stock was updated.",
      duration: "8.7 s",
      metrics: [
        { label: "Last reported updated", value: "600" },
        { label: "Expected products", value: "1,000" },
        { label: "Final result", value: "Not reported" },
      ],
      events: [
        {
          id: "progress",
          title: "Stock update reported",
          summary: "600 / 1,000 products",
          detail:
            "The application reported this absolute progress snapshot after updateStock returned. It is the last recorded progress, not a guarantee of the final database state.",
          kind: "step",
        },
        {
          id: "failure",
          title: "Sync failed",
          summary: "SUPPLIER_SYNC_FAILED",
          detail:
            "The application's catch block marked this run failed and rethrew the original error. Flowmark does not retry the sync. The original exception remains in your existing logs.",
          kind: "error",
        },
      ],
    },
  },
  {
    id: "order",
    label: "Order fulfillment",
    question: "Payment went through. Was the shipment created?",
    description:
      "A failed order run does not mean nothing happened. Mark the meaningful checkpoints so the next engineer knows what to investigate before retrying.",
    title: "orders/fulfill-order.ts",
    existingCode: `async function fulfillOrder(orderId: string) {
  try {
    await capturePayment(orderId)
    const shipment = await createShipment(orderId)
    return shipment
  } catch (error) {
    logger.error({ orderId, error }, "Fulfillment failed")
    throw error
  }
}`,
    code: `async function fulfillOrder(orderId: string) {
  const run = flowmark.workflow("order.fulfill", { properties: { orderId } })
  try {
    await capturePayment(orderId)
    run.step("payment-captured")
    const shipment = await createShipment(orderId)
    run.done({ result: { shipmentId: shipment.id } })
    return shipment
  } catch (error) {
    run.fail({ code: "FULFILLMENT_FAILED" })
    logger.error({ orderId, error }, "Fulfillment failed")
    throw error
  }
}`,
    preview: {
      name: "order.fulfill",
      status: "Failed",
      headline: "Payment reported captured. No shipment result.",
      explanation: "Investigate the shipment before retrying the whole order.",
      duration: "3.1 s",
      metrics: [
        { label: "Payment checkpoint", value: "Reached" },
        { label: "Shipment result", value: "Not reported" },
        { label: "Run outcome", value: "Failed" },
      ],
      events: [
        {
          id: "payment",
          title: "Payment captured",
          summary: "Checkpoint reached",
          detail:
            "The payment-captured checkpoint was emitted after capturePayment returned. Flowmark records this application report; it does not verify the payment with the provider.",
          kind: "step",
        },
        {
          id: "failure",
          title: "Fulfillment failed",
          summary: "FULFILLMENT_FAILED",
          detail:
            "The catch block reported failure without a shipment result. Missing shipment telemetry is not proof that no shipment exists. Check the application logs and shipping provider before retrying.",
          kind: "error",
        },
      ],
    },
  },
]
