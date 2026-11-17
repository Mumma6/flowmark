import { after } from "next/server"
import { flowmark } from "../../../lib/flowmark.js"
import { importInvoices } from "../../../lib/import-invoices.js"

export async function POST() {
  after(async () => {
    const flow = flowmark.workflow("consumer.background")
    await importInvoices(flow, "partial")
  })
  return Response.json({ accepted: true })
}
