import { createFlowmarkProxy } from "@flowmarkdev/node/next/proxy"

export const runtime = "nodejs"

// This local-only dev harness has no user sessions. Real apps should supply an authorize callback.
export const POST = createFlowmarkProxy({
  apiKey: "fm_diagnostics_write_local_only",
})
