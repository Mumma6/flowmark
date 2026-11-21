import assert from "node:assert/strict"
import { channel } from "node:diagnostics_channel"
import { createFlowmark } from "@flowmarkdev/node"
import process from "node:process"
import { runCaptureProbe, sendCaptureProbe } from "../lib/capture-probe.mjs"

const trials = JSON.parse(process.argv[2])
let dependencyResponses = 0
const responses = channel("undici:request:headers")
const existingObserver = ({ request }) => {
  if (
    request.origin === process.env.FLOWMARK_API_URL &&
    request.path.startsWith("/capture-fixture/") &&
    request.method === "GET"
  ) {
    dependencyResponses++
  }
}
responses.subscribe(existingObserver)
const flowmark = createFlowmark()
try {
  const run = async (trial) => {
    const { export: evidence, ...response } = await runCaptureProbe(
      flowmark,
      trial,
    )
    return {
      ...response,
      delivery: await sendCaptureProbe(process.env.FLOWMARK_API_URL, evidence),
    }
  }
  const results = []
  for (let offset = 0; offset < trials.length; offset += 8) {
    results.push(
      ...(await Promise.all(trials.slice(offset, offset + 8).map(run))),
    )
  }
  assert.equal(
    dependencyResponses,
    trials.reduce((total, trial) => total + (trial.overflow ? 3 : 2), 0),
  )
  console.log(JSON.stringify(results))
} finally {
  responses.unsubscribe(existingObserver)
  await flowmark.shutdown()
}
