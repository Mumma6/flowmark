"use server"

import { flowmark } from "../../lib/flowmark.js"
import { importInvoices } from "../../lib/import-invoices.js"

export async function importAction() {
  const flow = flowmark.workflow("consumer.action")
  await importInvoices(flow)
}
