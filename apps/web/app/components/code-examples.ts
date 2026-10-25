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
    id: "checkout",
    label: "Checkout",
    question: "Payment succeeded. What did operations still need to do?",
    description:
      "Mark the business steps you already run. Operations can see which ones completed — and what is still missing — without asking an engineer to reconstruct the trail.",
    title: "checkout/complete-order.ts",
    existingCode: `async function checkoutOrder(orderId: string) {
  try {
    await capturePayment(orderId)
    const shipment = await createShipment(orderId)
    return shipment
  } catch (error) {
    logger.error({ orderId, error }, "Checkout failed")
    throw error
  }
}`,
    code: `async function checkoutOrder(orderId: string) {
  const run = flowmark.workflow("checkout.order", { properties: { orderId } })
  try {
    await capturePayment(orderId)
    run.step("payment-captured")
    const shipment = await createShipment(orderId)
    run.done({ result: { shipmentId: shipment.id } })
    return shipment
  } catch (error) {
    run.fail({ code: "CHECKOUT_FAILED" })
    logger.error({ orderId, error }, "Checkout failed")
    throw error
  }
}`,
    preview: {
      name: "checkout.order",
      status: "Failed",
      headline: "Payment captured. No shipment result.",
      explanation:
        "Operations can see the payment step. The shipment never reported a result.",
      duration: "3.1 s",
      metrics: [
        { label: "Payment", value: "Captured" },
        { label: "Shipment", value: "Not reported" },
        { label: "Outcome", value: "Failed" },
      ],
      events: [
        {
          id: "payment",
          title: "Payment captured",
          summary: "Business step reached",
          detail:
            "The application reported this step after capturePayment returned. Flowmark records that report; it does not verify the payment with the provider.",
          kind: "step",
        },
        {
          id: "failure",
          title: "Checkout failed",
          summary: "CHECKOUT_FAILED",
          detail:
            "The catch block reported failure without a shipment result. Missing telemetry is not proof that no shipment exists. Check the application and provider before retrying.",
          kind: "error",
        },
      ],
    },
  },
  {
    id: "sync",
    label: "Sync",
    question: "The integration stopped. How far did operations get?",
    description:
      "Keep the sync you already have. Report progress so operations can see the last known point — not guess from a failed job status.",
    title: "jobs/sync-records.ts",
    existingCode: `async function syncRecords(sourceId: string) {
  try {
    const total = await countRecords(sourceId)
    for await (const page of fetchRecordPages(sourceId)) {
      await updateRecords(page)
    }
  } catch (error) {
    logger.error({ sourceId, error }, "Sync failed")
    throw error
  }
}`,
    code: `async function syncRecords(sourceId: string) {
  const run = flowmark.workflow("records.sync", { properties: { sourceId } })
  let updated = 0
  try {
    const total = await countRecords(sourceId)
    for await (const page of fetchRecordPages(sourceId)) {
      await updateRecords(page)
      updated += page.length
      run.progress({ completed: updated, total, unit: "records" })
    }
    run.done({ result: { updated } })
  } catch (error) {
    run.fail({ code: "SYNC_FAILED", result: { updated } })
    logger.error({ sourceId, error }, "Sync failed")
    throw error
  }
}`,
    preview: {
      name: "records.sync",
      status: "Failed",
      headline: "Last reported: 600 of 1,000 records.",
      explanation:
        "The sync failed. Do not assume the remaining records were updated.",
      duration: "8.7 s",
      metrics: [
        { label: "Last reported", value: "600" },
        { label: "Expected", value: "1,000" },
        { label: "Final result", value: "Not reported" },
      ],
      events: [
        {
          id: "progress",
          title: "Progress reported",
          summary: "600 / 1,000 records",
          detail:
            "The application reported this absolute progress snapshot after updateRecords returned. It is the last recorded progress, not a guarantee of the final database state.",
          kind: "step",
        },
        {
          id: "failure",
          title: "Sync failed",
          summary: "SYNC_FAILED",
          detail:
            "The catch block marked the process failed and rethrew the original error. Flowmark does not retry the sync. The original exception remains in your existing logs.",
          kind: "error",
        },
      ],
    },
  },
  {
    id: "job",
    label: "Scheduled job",
    question: "The nightly job completed. What did it actually produce?",
    description:
      "A green job is not the same as the business result. Report what the job accomplished so operations can see succeeded, failed, and skipped work.",
    title: "jobs/nightly.ts",
    existingCode: `async function runNightlyJob(jobId: string) {
  try {
    const items = await loadWork(jobId)
    const result = await processWork(items)
    return result
  } catch (error) {
    logger.error({ jobId, error }, "Job failed")
    throw error
  }
}`,
    code: `async function runNightlyJob(jobId: string) {
  const run = flowmark.workflow("job.nightly", { properties: { jobId } })
  try {
    const items = await loadWork(jobId)
    run.step("work-loaded", { properties: { count: items.length } })
    const result = await processWork(items)
    run.done({ result })
    return result
  } catch (error) {
    run.fail({ code: "JOB_FAILED" })
    logger.error({ jobId, error }, "Job failed")
    throw error
  }
}`,
    preview: {
      name: "job.nightly",
      status: "Completed",
      headline: "988 succeeded. 12 need attention.",
      explanation:
        "The job completed, but the reported result is not a full success.",
      duration: "2.4 s",
      metrics: [
        { label: "Loaded", value: "1,000" },
        { label: "Succeeded", value: "988" },
        { label: "Failed", value: "12" },
      ],
      events: [
        {
          id: "source",
          title: "Work loaded",
          summary: "1,000 items received",
          detail:
            "The work-loaded checkpoint reported count: 1000. This confirms what the job received, not what it produced.",
          kind: "step",
        },
        {
          id: "result",
          title: "Job completed",
          summary: "988 succeeded · 12 failed",
          detail:
            "processWork returned { succeeded: 988, failed: 12 }. The application attached that result. No per-item failure reasons were recorded by this instrumentation.",
          kind: "done",
        },
      ],
    },
  },
]
