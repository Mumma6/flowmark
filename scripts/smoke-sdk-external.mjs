#!/usr/bin/env node
/**
 * Hosted smoke test for @flowmarkdev/node (workspace build or registry install).
 *
 * From this repository (uses the built workspace package):
 *   FLOWMARK_API_KEY=... FLOWMARK_API_URL=https://api.flowmark.dev \
 *     node scripts/smoke-sdk-external.mjs
 *
 * From an external install of the published package, point NODE_PATH at
 * node_modules or run after `npm i @flowmarkdev/node@alpha`.
 *
 * Optional:
 *   FLOWMARK_SMOKE_EXPECT_REJECT=1  — also exercise a bad key path
 */
import console from "node:console"
import path from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

async function loadSdk() {
  try {
    return await import("@flowmarkdev/node")
  } catch {
    const local = path.join(here, "../packages/sdk/dist/index.js")
    return import(pathToFileURL(local).href)
  }
}

const { createFlowmark } = await loadSdk()

const apiKey = process.env.FLOWMARK_API_KEY
const apiUrl = process.env.FLOWMARK_API_URL ?? "https://api.flowmark.dev"

if (!apiKey) {
  console.error("FLOWMARK_API_KEY is required")
  process.exit(1)
}

const flowmark = createFlowmark({ apiKey, apiUrl })
const flow = flowmark.workflow("sdk.smoke.publish", {
  properties: { source: "scripts/smoke-sdk-external.mjs" },
})
flow.step("started")
flow.done({ result: { ok: true } })
await flowmark.flush()
await flowmark.shutdown()
console.log("ingest-ok", { apiUrl })

if (process.env.FLOWMARK_SMOKE_EXPECT_REJECT === "1") {
  const bad = createFlowmark({ apiKey: "fm_invalid_smoke_key", apiUrl })
  const rejected = bad.workflow("sdk.smoke.reject")
  rejected.step("should-fail-delivery")
  rejected.done({ result: { ok: false } })
  try {
    await bad.flush()
    await bad.shutdown()
    console.error("reject-path-expected-delivery-failure")
    process.exit(1)
  } catch {
    console.log("reject-path-ok")
  }
}
