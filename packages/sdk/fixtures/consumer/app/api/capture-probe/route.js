import { after } from "next/server"
import { flowmark } from "../../../lib/flowmark.js"
import {
  runCaptureProbe,
  sendCaptureProbe,
} from "../../../lib/capture-probe.mjs"

export const runtime = "nodejs"

export async function POST(request) {
  const trial = await request.json()
  const { export: evidence, ...response } = await runCaptureProbe(
    flowmark,
    trial,
  )
  if (evidence) {
    after(() => sendCaptureProbe(process.env.FLOWMARK_API_URL, evidence))
  }
  return Response.json(response)
}
