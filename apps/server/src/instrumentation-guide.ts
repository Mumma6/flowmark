/** Versioned public instructions. The live route targets the installable npm SDK. */
export function instrumentationGuide(
  apiOrigin: string,
  sdkVersion: "0.3.0" | "0.4.0" = "0.3.0",
): string {
  const preview = sdkVersion === "0.4.0"
  const urlEnvironment =
    !preview || apiOrigin !== "https://api.flowmark.dev"
      ? `\n\`FLOWMARK_API_URL=${apiOrigin}\``
      : ""
  const operationOptions = preview
    ? ""
    : ', { mapError: () => ({ code: "IMPORT_OPERATION_FAILED" }) }'
  const body = `    const invoices = await flow.operation("load-invoices", () => loadInvoices(batchId)${operationOptions})
    flow.step("source-loaded", { properties: { count: invoices.length } })
    const result = await flow.operation("save-invoices", () => saveInvoices(invoices)${operationOptions})
    flow.done({
      outcome: result.rejected > 0 ? "partial" : "complete",
      result: { imported: result.imported, rejected: result.rejected },
    })
    return result`
  const process = preview
    ? `export function importInvoices(flowmark: Pick<FlowmarkClient, "workflow">, batchId: string) {
  return flowmark.workflow("invoice.import", async flow => {
${body}
  }, { properties: { batchId } })
}`
    : `export async function importInvoices(flowmark: Pick<FlowmarkClient, "workflow">, batchId: string) {
  const flow = flowmark.workflow("invoice.import", { properties: { batchId } })
  try {
${body}
  } catch (error) {
    flow.fail({ code: "IMPORT_FAILED" })
    throw error
  }
}`
  return `# Instrument one process with Flowmark

Flowmark observes work your application already runs. It does not schedule or retry it. Fetching this guide does not connect an agent.

## 1. Install and set server credentials

${
  preview
    ? "**Unreleased SDK 0.4.0 evaluation.** Install the supplied local core/SDK tarballs. This version is not available from npm; do not substitute the published package. The callback API below is new in 0.4.0."
    : "This guide targets published **@flowmarkdev/node@0.3.0**. Install with `npm i @flowmarkdev/node@0.3.0` (Node >=20.19; Next >=16 for the Next adapter)."
}

Ask the developer to set these server variables. Never read, print, commit or request the key in chat. Never use NEXT_PUBLIC_*.

\`FLOWMARK_API_KEY=<project server-write key>\`${urlEnvironment}

The URL is an API origin, not a path ending in \`/v1/events\`. ${preview ? "0.4.0 hosted users may omit the URL; the default is https://api.flowmark.dev. Local/staging APIs need their explicit origin." : "0.3.0 requires an explicit production URL; set it locally too when using hosted Flowmark."} Next loads its env files; a standalone script must inherit or load its environment before creating the client.

## 2. Choose the entry point, then share business logic

- **Next App Router Route Handler, Server Action or HTTP cron endpoint:** use \`@flowmarkdev/node/next\` in one shared server-only module. The adapter owns delivery. Do not call \`shutdown()\` yourself.
- **Standalone CLI, worker or other Node server:** use \`@flowmarkdev/node\`. The process owns its client and shutdown.
- **Both in one app:** use those two entry points and pass the client into shared business logic. The business module imports only SDK types. No runtime adapter or runtime detection is needed.

\`\`\`ts
// lib/flowmark.ts — imported only by Next server entry points
import { createFlowmark } from "@flowmarkdev/node/next"
export const flowmark = createFlowmark()
\`\`\`

Next client construction and typed definitions are inert and need no credentials during builds. Start workflows inside a handler/action, not module initialization or render. Rendering can repeat during build/revalidation. Use the Node.js runtime; this adapter does not support Pages API routes, Edge/Proxy or standalone scripts.

**Configuration errors are deliberate errors:** missing keys or invalid settings throw at Node creation or the first Next workflow/settlement call. Let them remain visible; fix configuration. **Marker validation and delivery failures are diagnostics:** ordinary markers contain them, so no nullable client, fallback client or per-marker catch is needed. Only explicit Node drains can reject for delivery failures.

## 3. Add meaningful evidence

Choose one real process, such as an import or briefing generation. Keep its existing authentication, inputs, return values, exceptions and retry behavior. \`loadInvoices\` and \`saveInvoices\` here represent existing application helpers:

Start observation before the process's first I/O call. Put known job IDs in initial properties; if an attempt number becomes known later, call \`flow.setProperties({ attempt })\` inside the workflow instead of moving preparation outside it.

\`\`\`ts
// business/import-invoices.ts
import type { FlowmarkClient } from "@flowmarkdev/node"

${process}

// app/api/import/route.ts
import { flowmark } from "@/lib/flowmark"
import { importInvoices } from "@/business/import-invoices"

export const runtime = "nodejs"

export async function POST(request: Request) {
  // Keep existing authentication and validation before starting the process.
  const { batchId } = await request.json()
  return Response.json(await importInvoices(flowmark, batchId))
}
\`\`\`

A Server Action calls the same shared function with its Next client. An application's scheduler owns invoking the cron endpoint and deciding retries; Flowmark does neither.

${preview ? "The callback form observes one complete invocation: normal return requests completion; an unhandled exception records `workflow_failed` and rethrows the same original value. Explicit `done({ outcome, result })` supplies business meaning; explicit `fail({ code, outcome?, result? })` supplies a known failure. Use manual `workflow(name, options)` when the process continues in another invocation." : "`workflow()` starts an execution. Only `done()`/`fail()` close it; preserve the application's original exception by rethrowing it after `fail()`."}

\`step()\` is an instant milestone; \`operation()\` measures work and preserves its value or original rejection. A failed operation alone does not fail the workflow: the application may recover and finish with a partial result. ${preview ? "Synchronous operation callbacks also work; await their returned Promise. Raw exception fields are never copied by default; use mapError only for deliberately selected safe details." : "In 0.3.0, keep the shown mapError callbacks: otherwise exception messages/fields are copied. Select fixed safe codes, not raw exceptions."}

Completion describes execution; \`outcome\` describes the application's reported business result. Use codes like complete, partial or no-change with known counts. A technical failure after useful work may use \`fail({ code: "IMPORT_FAILED", outcome: "partial", result: { imported: 8 } })\`. Outcomes match \`^[a-z][a-z0-9_-]{0,63}$\`. Keep summaries small and JSON-safe; leave credentials, raw exceptions and personal data out.

## 4. CLI: same business function, process-owned delivery

\`\`\`ts
import { createFlowmark } from "@flowmarkdev/node"
import { importInvoices } from "./business/import-invoices"

const flowmark = createFlowmark()
try {
  await importInvoices(flowmark, "batch-id")
} finally {
  try {
    await flowmark.shutdown()
  } catch (error) {
    console.error("Flowmark delivery failed", error)
  }
}
\`\`\`

That catch preserves the application's original error or successful result while making delivery failure visible. Long-lived processes reuse the client, may \`flush()\` between jobs, and shut down after all work finishes. The SDK installs no signal handlers. Next does this draining automatically through \`after()\`, even if a handler throws; developers do not need to call it for normal instrumentation.

If the application intentionally does business work after its response, put that work in its own \`after(async () => { await importInvoices(flowmark, batchId) })\`. A separate worker uses Node. Host duration limits still apply; unawaited promises do not establish a lifetime. Delivery is best-effort memory storage, not a durable queue. HTTP timeout is 3 seconds, transient errors retry at most twice; authentication errors are not retried. See [delivery](https://docs.flowmark.dev/docs/delivery).

## 5. Verify once, then expand only when useful

Run a safe existing success, partial result and failure. Compare application results/exit status before and after instrumentation; verify operation evidence and final outcome/result. Build Next without runtime keys, then run with credentials. Check delivery diagnostics and Studio evidence; installation alone proves no delivery. Do not trigger destructive or external business actions merely to generate telemetry.

A scheduler retry is a **new run**: omit id and put the durable job/order ID plus attempt count in properties. Persist a prior run reference only if retryOf linkage is useful. A multi-request continuation instead reuses the same workflow name and execution id and completes only when the whole process ends. [Attempts and retries](https://docs.flowmark.dev/docs/reference/attempts) covers retryOf and operation attempts (requires attempts-v1).

Keep workflow names stable across refactors; release identifies a deployment. Removing instrumentation does not delete history or fail unfinished runs. [Workflow lifecycle](https://docs.flowmark.dev/docs/concepts/runs) explains continuations and code changes.

Optional references: [progress](https://docs.flowmark.dev/docs/reference/progress), [business snapshots](https://docs.flowmark.dev/docs/reference/report), [typed workflows](https://docs.flowmark.dev/docs/reference/define-workflow), [expectations](https://docs.flowmark.dev/docs/reference/expectations) (requires expectations-v1), [relationships](https://docs.flowmark.dev/docs/concepts/related-runs), [browser integration](https://docs.flowmark.dev/docs/browser). Read these only when the process needs that evidence; this guide is sufficient for the first server integration.
`
}
