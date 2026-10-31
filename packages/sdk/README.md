# @flowmarkdev/node

**Understand every execution.**

Flowmark is workflow observability for processes your application already
runs. You mark a named process in ordinary TypeScript. Each execution becomes
evidence you can open in the dashboard — milestones, operations, progress,
errors, and the result your code reported.

Flowmark observes. It does not execute, schedule, or retry your work.

```bash
npm i @flowmarkdev/node
```

Docs: [docs.flowmark.dev](https://docs.flowmark.dev) · Product:
[flowmark.dev](https://flowmark.dev)

## Effect compatibility (repository migration)

The repository has migrated to Effect 4.1.0; this does not publish a new SDK
version. Ordinary client calls remain TypeScript/Promises with the same event
JSON. Advanced custom transports and code consuming exported core schemas must
use matching Effect v4 values. Underlying Effect Cause/HTTP errors and Promise
failure wrappers differ from v3; avoid relying on v3 error internals. Core and
Node packages should be upgraded together when this migration is released.

## Quick start

**Next.js** (Route Handler or Server Action):

```ts
// lib/flowmark.ts — server only
import { createFlowmark } from "@flowmarkdev/node/next"

export const flowmark = createFlowmark()
```

**Node** (worker, script, long-lived server):

```ts
import { createFlowmark } from "@flowmarkdev/node"

export const flowmark = createFlowmark()
```

**Browser** (Client Component / event handler):

```ts
import { createFlowmark } from "@flowmarkdev/node/browser"
```

Create one shared client module. Use `@flowmarkdev/node/next` only on the
server — it drains with Next.js `after()`.

```bash
FLOWMARK_API_KEY=<project write key>
FLOWMARK_API_URL=https://api.flowmark.dev
```

Server only. Never put the write key in `NEXT_PUBLIC_*` or a browser bundle.
`FLOWMARK_API_URL` is the API origin (not `/v1/events`). Production needs an
explicit origin; local development defaults to `http://localhost:3003`.

```ts
import { flowmark } from "./flowmark"

export async function completeCheckout(orderId: string) {
  const flow = flowmark.workflow("checkout.order", {
    properties: { orderId },
  })
  try {
    flow.step("payment-captured")
    const shipment = await flow.operation("create-shipment", () =>
      createShipment(orderId),
    )
    flow.done({ result: { shipmentId: shipment.id } })
    return shipment
  } catch (error) {
    flow.fail({ code: "CHECKOUT_FAILED" })
    throw error
  }
}
```

Keep the function's return value and thrown errors. Telemetry failures never
change business behavior.

## API

| Method                                                    | Role                                       |
| --------------------------------------------------------- | ------------------------------------------ |
| `createFlowmark()`                                        | Shared client                              |
| `workflow(name, options?)`                                | Start or continue a run                    |
| `flow.runId`                                              | This execution's id                        |
| `flow.step(name)`                                         | Instant milestone                          |
| `flow.operation(name, fn)`                                | Timed work (failures stay on the timeline) |
| `flow.progress({ completed, total?, unit? })`             | Absolute snapshot                          |
| `flow.error({ code, handled, retryable? })`               | Non-terminal observation                   |
| `flow.setProperties(props)`                               | Amend run context                          |
| `flow.done({ result? })` / `flow.fail({ code, result? })` | End the run                                |
| `flowmark.flush()` / `shutdown()`                         | Node delivery drain (Next drains itself)   |

Options on `workflow()`: `id`, `properties`, `environment`, `release`,
`correlationId`, `parentRunId`.

## Patterns

**One request.** Start, mark, finish in the same handler (example above).

**Same process, later request.** Pass the same workflow `name` and `id`.
Persist `flow.runId` (or your execution id) on the application record. Call
`done()` / `fail()` only when the whole process is finished.

```ts
const flow = flowmark.workflow("expedition.run", { id: expedition.id })
flow.step("draft-started")
// …later request with the same name + id…
flow.done({ result: { battlesWon: 2 } })
```

Use a fresh execution id for each run. Durable entity ids (the same order
across jobs) belong in `properties`.

**Related processes.** Start a new `workflow()` and pass `correlationId`
and/or `parentRunId` through your own payload. Nothing is propagated
automatically.

**Results.** Small JSON-safe summaries you already know: counts, status
enums, opaque ids. Limits: depth 5, 128 keys, 128-character keys,
2,048-character strings, 16 KiB per object.

## Configuration

`defineConfig()` is a typed helper. It does not load env or create a client.
Import a config object and pass it to `createFlowmark(config)` if you want.

Server clients read `FLOWMARK_API_KEY` / `FLOWMARK_API_URL` when omitted from
config. Browser clients use `@flowmarkdev/node/browser` with a public browser
key, or omit the key and proxy via `@flowmarkdev/node/next/proxy`.

## Semantics worth knowing

- `operation()` measures duration and rethrows the original error. It does
  not fail the run by itself.
- `error({ handled })` stays on the timeline. Only `fail()` makes the run
  failed.
- `done()` / `fail()`: first terminal wins. Open operations delay completion;
  `fail()` can supersede a pending `done()`.
- `retryable` describes a failure. Flowmark does not retry your work.
- Node: `await flowmark.shutdown()` before process exit. `flush()` /
  `shutdown()` may reject on delivery failure; markers on the flow do not.

## Browser notes

Browser entry points never read server env. Prefer a public browser key or a
same-origin proxy. Create workflows from event handlers or effects, not
during render.

## License

MIT · [Mumma6/flowmark](https://github.com/Mumma6/flowmark)

### Business outcomes (unreleased source capability)

```ts
const flow = flowmark.workflow("customer.import", {
  properties: { definitionRevision: "import-v1" },
})
// Your application performs its existing work.
flow.done({ outcome: "partial", result: { imported: 988, skipped: 12 } })
// Alternative terminal call on a failed run:
// flow.fail({ code: "CRM_TIMEOUT", outcome: "partial", result: { updated: 80 } })
```

Optional `outcome` is a case-sensitive 1–64 character code matching
`^[a-z][a-z0-9_-]{0,63}$`. It is independent of technical completion/failure and
optional bounded result details; absence means unknown. Fields within `result` are ordinary application data; no mapping to outcome is performed. Invalid codes use instrumentation diagnostics. Node, Next,
browser and advanced marker APIs share this behavior.

Optional immutable workflow presentation revisions label ordered counts, units,
categories and nested reasons in the dashboard. Start properties select
`definitionRevision`; runs without one use the default result view.
Canonical outcome needs no configuration. Browser reports are untrusted.

Deploy accepting server/schema/readers before enabling this field in a writer;
verify persistence end to end. Package publication is a separate
release, so do not assume the currently published SDK supports this capability.
See [the completion reference](https://docs.flowmark.dev/docs/reference/completion)
and the local `examples/outcomes.mjs` demonstration. Report snapshots and typed
workflow definitions are not implemented by this change.

## Live business snapshots

`flow.report(snapshot)` records a bounded, absolute non-final business result.
Each snapshot replaces the whole previous snapshot; omitted fields are unknown.
Use one cumulative reporter and report after committed batches. Latest means
latest received by the server, not greatest application timestamp. Reports never
become final results implicitly, change progress or set a business outcome.

```ts
flow.report({ imported: 6000, rejected: 50, reasons: { invalid: 50 } })
flow.report({ imported: 9600 }) // rejected and reasons are now unknown
flow.done() // final result remains unknown
```

The dashboard keeps last-reported work and its timestamps separate from final
results. Interrupted telemetry proves neither liveness nor failure. Reports
remain in the timeline after completion; post-terminal reports are ignored.
Browser-reported evidence remains untrusted. Optional result declarations also
label non-final snapshots using the original start's explicit definitionRevision.

Requires accepting server/storage support (migration 0010) before writer use.
Older servers reject report events through normal delivery diagnostics; there is
no fallback encoding. Package publication is separate. Existing queue limits and
runtime-specific drains still apply. See the report reference for bounds and
single-reporter ordering limitations.

## Typed workflow definitions

Optionally bind context, result and outcome types to a reusable workflow name:

```ts
const imports = flowmark.defineWorkflow<
  { batchId: string },
  { imported: number; rejected: number },
  "complete" | "partial"
>("customer.import")
const flow = imports.start({ properties: { batchId: "synthetic-42" } })
flow.report({ imported: 6000 })
flow.done({ outcome: "partial", result: { imported: 9600, rejected: 100 } })
```

Creating a definition is inert; start uses the existing runtime/client lifecycle.
Required context is required at start; reports and context amendments are shallow
partials, while provided terminal results must be complete. Types are erased and
do not replace runtime input validation or register dashboard declarations.
Existing untyped workflow calls remain supported. This is an additive source API
with unchanged wire data; package publication is separate. See the
[definition reference](https://docs.flowmark.dev/docs/reference/define-workflow)
for CRM examples, type errors and migration guidance.

## Searchable business references

```ts
const flow = flowmark.workflow("customer.import", {
  properties: { batchId: "synthetic-batch-42", provider: "crm-a" },
})
// Application code performs the import.
flow.done({ result: { imported: 9600 } })
```

Enable reviewed `batchId` reference search and bounded `provider` category values
on the dashboard workflow page, then use the exact business filters in Run
history. Search matches run-level initial properties plus accepted shallow
amendments, never step/operation context. Existing stored values become searchable
when enabled; disable the key to revoke filtering. Keep personal data and secrets
out of telemetry. Execution IDs remain distinct from business references. No new
SDK field or package release is required for this search capability.
