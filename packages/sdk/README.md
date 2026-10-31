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
- `done()` / `fail()`: first terminal accepted by the server wins across requests. Open operations delay completion;
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

## Cross-request continuation

Save and explicitly propagate a `WorkflowRunReference` (`{ workflow, runId }`)
from the submission to an authorized callback, then call
`flowmark.workflow(ref.workflow, { id: ref.runId })`. The reference is a plain
identity within the credential's project, not an authorization token or remote
state lookup. Repeated starts never amend original context/release/environment;
use accepted `setProperties()` calls while open. A new attempt gets a new ID.

Do not complete a booking submission while it still awaits its business callback.
A later process/client may continue the open run. Local operation waiting cannot
coordinate other handles. Replayed envelope IDs are duplicates; new terminal
IDs after closing are HTTP 409 conflicts, even for identical payloads. Ordinary
post-terminal markers are ignored explicitly. Conflicts reach diagnostics and
explicit drain failures; application behavior is preserved. Historical mixed
terminals retain their stored interpretation. The accepting backend is required
for this policy; old backends keep their old behavior. No schema change or
package publication is included here.

See [the continuation decision and transition matrix](https://github.com/Mumma6/flowmark/blob/staging/docs/sdk/run-continuation.md)
and [the booking example](https://github.com/Mumma6/flowmark/blob/staging/packages/sdk/examples/booking-continuation.mjs).

## Bulk work and delivery health

Progress remains per call by default. For bursts, opt into
`createFlowmark({ delivery: { progress: "latest" } })` on Node, Next.js or browser.
Adjacent unsent progress for one handle is replaced by the latest validated whole
absolute snapshot. Other markers, flush boundaries and in-flight delivery seal
it in order. Historical progress density changes only with this opt-in.
Business `report()` snapshots remain separate; report them per useful batch.

The queue holds at most 1,000 pending events. Progress/report admission stops at
900 total pending, reserving 100 slots for other markers. Queued events are never
evicted. Critical overload can still drop new markers; this is best-effort delivery.
Drains reject with at most 20 original `failures`, plus `failureCount` and
`omittedFailureCount`. The callback still receives every failure.

Node/browser `flowmark.deliveryHealth()` returns pending/replaceable slot counts,
cumulative coalesced/dropped/failed counters and a last failure tag. It contains
no payloads/credentials and stays available after shutdown. Drains clear their
failure samples, not health. Next accepts `onDeliveryHealth` directly on its
`createFlowmark()` for final request-local health after each workflow drains;
it keeps its automatic `after()` lifecycle and contains callback errors.

Keep browser payloads small: keepalive quotas and unload/offline limits still
apply. Node jobs should explicitly drain at process exit while preserving their
original return/error. See the [bulk import example](https://github.com/Mumma6/flowmark/blob/staging/packages/sdk/examples/bulk-import.mjs)
and [delivery documentation](https://docs.flowmark.dev/docs/delivery).

## Safe callback error mapping

Operation callbacks preserve their exact original rejection. By default, Flowmark
still copies bounded structured failures and `Error.message`. To choose safe
telemetry fields explicitly, use a synchronous per-operation mapper:

```ts
await flow.operation("crm-request", () => crm.request(), {
  mapError: (_cause) => ({
    code: "CRM_UNAVAILABLE",
    message: "CRM temporarily unavailable",
    retryable: true,
  }),
})
```

`mapError` receives `unknown` and returns `WorkflowFailure`. Only validated
`code`, optional `message` and optional `retryable` are sent; no original message
or stack is appended. Throwing/invalid mappers use `{ code: "operation_failed" }`
and report `FlowmarkErrorMappingError` (`reason: "threw" | "invalid"`) through
instrumentation diagnostics and explicit drain failures. Diagnostics retain no
original cause or invalid mapped payload. Async mappers are unsupported; their
returned promises are not awaited and rejected results are contained.

This option works in Node, Next.js, browser and custom-transport callbacks.
Manual operation handles keep their explicit `fail()` behavior. An operation
failure does not fail the run automatically; recovery can still end with `done()`.
Expected domain rejections belong in reported result/reason counts. Mapping is
not automatic redaction of context, results, or fields you select yourself.
See the [CRM import example](https://github.com/Mumma6/flowmark/blob/staging/packages/sdk/examples/safe-operation-errors.mjs).

### Explicit application-owned attempts

After deploying a server that acknowledges `attempts-v1`, opt in per operation:

```ts
const first = flow.operation("push-to-crm", {
  attempt: { groupId: "batch-42", number: 1 },
})
first.fail({ code: "CRM_UNAVAILABLE", retryable: true })
// Your application decides to retry and executes the work itself.
await flow.operation("push-to-crm", () => pushToCrm(), {
  attempt: { groupId: "batch-42", number: 2 },
})
const retry = flowmark.workflow("crm.sync", {
  retryOf: { workflow: "crm.sync", runId: previous.runId },
})
```

Groups are scoped to one run and operation name (nonblank, maximum 128 characters); ordinals are positive safe integers. Each attempt has a new operation ID; `retryOf` starts a separate execution with its own run ID. Earlier failure evidence and reported results remain unchanged. Repeated unannotated operations are not inferred retries. Cross-run results are reported work, not deduplicated items. Qualified references resolve only within the authorized project.

Deploy the TASK-009 schema, API and readers before using these options. HTTP delivery requires the `attempts-v1` capability receipt; older servers that omit it produce diagnostics and failed drains rather than silently claiming metadata support. They may already have accepted a stripped event. Update same-origin proxies too; custom transports own compatibility. Calls without these options remain unchanged. See the [attempt contract](https://docs.flowmark.dev/docs/reference/attempts) and the runnable loopback example `examples/explicit-attempts.mjs`.

### Expected confirmations

```ts
const flow = flowmark.workflow("booking.submit")
const confirmation = flow.expect("provider-response", {
  id: confirmationId,
  within: "5m",
})
flow.done({ outcome: "submitted", result: { submitted: 1 } })
// Persist/forward the reference explicitly; the application owns its callback.
// Later, on an authenticated server callback using a configured client:
flowmark.resolveExpectation(confirmation, {
  outcome: "no-availability",
  result: { reserved: 0 },
})
// Alternative: flowmark.cancelExpectation(confirmation, { code: "BOOKING_CANCELLED" })
```

Declarations fix a server-observed deadline; resolution timing does not verify business success. Explicit settlement survives process restarts and may follow terminal completion without reopening the run or changing its final result. References are not credentials or delivery acknowledgments. Node drains explicitly; Next registers settlement-only requests.

IDs/names are nonblank, at most 128 characters; durations are positive integer `ms|s|m|h|d`, 1 ms–7 days. The retained lifetime limit is 100 IDs/run, including unmatched settlements. Identical declarations never reset deadlines; first accepted settlement wins. Missing/incomplete evidence stays unknown. Reads evaluate pending/overdue/on-time/late/cancelled states; no scheduler or notification is installed and retention is unchanged.

Deploy the accepting `expectations-v1` storage/API/readers before enabling these methods; aligned package publication is separate. Direct browser mode uses untrusted `browser.` references. The generic server-key proxy rejects expectation events. Advanced clients can use `createFlowmarkWithTransport({ transport })` for a shared settlement/drain lifecycle. See the [expectation guide](https://docs.flowmark.dev/docs/reference/expectations) and the loopback-only `examples/durable-expectations.mjs`.
