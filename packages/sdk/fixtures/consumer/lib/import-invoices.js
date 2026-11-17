export const originalFailure = new Error("SYNTHETIC_PRIVATE_PROVIDER_DETAIL")

// Shared business logic imports neither runtime adapter.
export async function importInvoices(flow, mode = "complete") {
  try {
    flow.step("validated")
    const result = await flow.operation("save-invoices", async () => {
      if (mode === "failure") throw originalFailure
      return {
        imported: mode === "partial" ? 8 : 10,
        rejected: mode === "partial" ? 2 : 0,
      }
    })
    flow.done({ outcome: result.rejected ? "partial" : "complete", result })
    return result
  } catch (error) {
    flow.fail({
      code: "IMPORT_FAILED",
      outcome: "not-imported",
      result: { imported: 0 },
    })
    throw error
  }
}
