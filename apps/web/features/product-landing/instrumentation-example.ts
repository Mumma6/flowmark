// Application code owns the queue and forwards the expectation reference to the worker.
export const customerSyncCode = `async function requestCustomerSync(syncRef: string) {
  const run = flowmark.workflow("customer.sync", {
    correlationId: syncRef,
    properties: { integration: "customer-api" },
  })

  try {
    const completion = run.expect("customer.sync.completed", {
      within: "10m",
    })
    const job = await enqueueCustomerSync({ syncRef, completion })
    run.done({
      outcome: job.accepted ? "queued" : "rejected",
      result: { accepted: job.accepted },
    })
    return job
  } catch (error) {
    run.fail({ code: "SYNC_QUEUE_FAILED" })
    throw error
  }
}`
