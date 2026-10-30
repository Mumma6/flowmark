#!/usr/bin/env node
// Synthetic SDK delivery benchmark. Fetch is replaced; no server is contacted.
import assert from "node:assert/strict"
import { resolve } from "node:path"
import { performance } from "node:perf_hooks"
import process from "node:process"
import console from "node:console"
import { pathToFileURL } from "node:url"

if (!globalThis.gc) {
  throw new Error(
    "Run with node --expose-gc scripts/benchmark-sdk.mjs [SDK entrypoint]",
  )
}

const sdkPath = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2])).href
  : new URL("../packages/sdk/dist/index.js", import.meta.url).href
const { createFlowmark } = await import(sdkPath)
const originalFetch = globalThis.fetch
const runs = 100
const eventsPerRun = 7
const diagnostics = []
let delivered = 0
let gate

globalThis.fetch = async () => {
  if (gate) {
    await gate
  }
  delivered++
  return new Response(null, { status: 202 })
}

const client = () =>
  createFlowmark({
    apiKey: "benchmark-placeholder",
    apiUrl: "http://127.0.0.1:1",
    onInstrumentationError: (error) => diagnostics.push(error),
  })

function recordBatch(sdk) {
  for (let index = 0; index < runs; index++) {
    const flow = sdk.workflow("benchmark.import", {
      properties: { source: "synthetic", index },
    })
    flow.step("loaded")
    flow.progress({ completed: 1, total: 2, unit: "rows" })
    flow.report({ rows: 1 })
    const operation = flow.operation("save")
    flow.done({ result: { rows: 1 } })
    operation.done()
  }
}

try {
  const timings = []
  for (let sample = 0; sample < 12; sample++) {
    const sdk = client()
    const before = delivered
    const start = performance.now()
    recordBatch(sdk)
    await sdk.shutdown()
    if (sample >= 3) {
      timings.push(performance.now() - start)
    }
    assert.equal(delivered - before, runs * eventsPerRun)
    assert.equal(diagnostics.length, 0)
  }

  const sdk = client()
  let release
  gate = new Promise((resolveGate) => {
    release = resolveGate
  })
  globalThis.gc()
  const before = process.memoryUsage().heapUsed
  recordBatch(sdk)
  // Let deliveries reach the blocked fetch and ordering semaphore before sampling.
  await new Promise((resolveTurn) => setImmediate(resolveTurn))
  globalThis.gc()
  const retained = process.memoryUsage().heapUsed - before
  release()
  gate = undefined
  await sdk.shutdown()
  assert.equal(diagnostics.length, 0)

  timings.sort((a, b) => a - b)
  console.log(
    JSON.stringify(
      {
        node: process.version,
        runsPerSample: runs,
        eventsPerSample: runs * eventsPerRun,
        warmups: 3,
        samples: timings.length,
        medianMilliseconds: Number(
          timings[Math.floor(timings.length / 2)].toFixed(2),
        ),
        minMilliseconds: Number(timings[0].toFixed(2)),
        maxMilliseconds: Number(timings.at(-1).toFixed(2)),
        blockedDeliveryHeapBytes: retained,
        note: "Mocked fetch; retained heap is one GC sample, not production peak memory.",
      },
      null,
      2,
    ),
  )
} finally {
  globalThis.fetch = originalFetch
}
