import { flowmark } from "../../../lib/flowmark.js"
import { importInvoices } from "../../../lib/import-invoices.js"

export const runtime = "nodejs"

export async function POST(request) {
  const { mode = "complete", id, retryOf } = await request.json()
  const flow = flowmark.workflow("consumer.import", { id, retryOf })
  try {
    const result = await importInvoices(flow, mode)
    return Response.json({ runId: flow.runId, result })
  } catch {
    return Response.json(
      { runId: flow.runId, code: "IMPORT_FAILED" },
      { status: 500 },
    )
  }
}
