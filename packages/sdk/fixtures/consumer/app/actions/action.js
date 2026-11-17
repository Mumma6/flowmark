"use server"

import { flowmark } from "../../lib/flowmark.js"
import { importInvoices } from "../../lib/import-invoices.js"

export async function importAction() {
  return flowmark.workflow("consumer.action", (flow) => importInvoices(flow))
}
