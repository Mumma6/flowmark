import { createRuntimeObservationEmitter } from "@flowmarkdev/node/next"
import { after } from "next/server"
import { flowmark } from "../../../lib/flowmark.js"
import { importInvoices } from "../../../lib/import-invoices.js"

import {
  observationPolicy,
  observationValues,
} from "../../../lib/runtime-observation.mjs"

const emitter = createRuntimeObservationEmitter(observationPolicy)

export async function POST() {
  after(async () => {
    await flowmark.workflow("consumer.background", (flow) => {
      emitter.observe(flow, observationValues)
      return importInvoices(flow, "partial")
    })
  })
  return Response.json({ accepted: true })
}
