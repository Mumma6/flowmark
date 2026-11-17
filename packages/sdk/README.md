# @flowmarkdev/node

**Know what your workflows actually accomplish.**

Flowmark records executions of processes your application already runs. You
mark a named process in ordinary TypeScript. Each execution can include
milestones, operations, progress, errors, and the result your code reported.

Flowmark observes. It does not execute, schedule, or retry your work. Telemetry
failures never replace your return value or thrown error.

```bash
npm i @flowmarkdev/node
```

Source package version: **0.4.0 (unreleased)** (see `package.json`). It depends on `@flowmarkdev/core` at the
same version. Node.js 20.19 or newer is required. Next.js 16 or newer is an
optional peer for `@flowmarkdev/node/next`.

Docs: [docs.flowmark.dev](https://docs.flowmark.dev) · Product:
[flowmark.dev](https://flowmark.dev)

The repository pins Effect 4.1.0 inside the SDK. Application code uses
TypeScript and Promises. Custom transports and direct `@flowmarkdev/core`
schema calls must use Effect v4 (`Schema.decodeUnknownEffect`, `schema.Type`).
Do not depend on Effect v3 error internals. Upgrade core and the Node SDK
together.

## Quick start

Create one shared client module.

**Next.js** (Route Handler or Server Action, server only):

```ts
import { createFlowmark } from "@flowmarkdev/node/next"

export const flowmark = createFlowmark()
```

The Next.js client drains with `after()`. Do not call `shutdown()` yourself.
Start runs inside Node-runtime App Router Route Handlers or Server Actions.
Importing/constructing the client during build is safe; render/static generation
is not a business-execution boundary. For application-owned work inside `after()`,
start and finish the workflow inside that callback.
Its public methods are `workflow`, `defineWorkflow`, `resolveExpectation`, and
`cancelExpectation`.

**Node** (worker, script, or long-lived server):

```ts
import { createFlowmark } from "@flowmarkdev/node"

export const flowmark = createFlowmark()
```

Call `await flowmark.shutdown()` before the process exits. `flush()` drains
without closing the client. Either call can reject when delivery fails.

**Browser** (event handler or effect, not during render):

```ts
import { createFlowmark } from "@flowmarkdev/node/browser"
```

Browser entry points never read server environment variables. Use a public
browser key, or omit the key and proxy through `@flowmarkdev/node/next/proxy`
(also exported as `@flowmarkdev/node/proxy`).

```bash
FLOWMARK_API_KEY=<project write key>
FLOWMARK_API_URL=https://api.flowmark.dev
```

The environment example above works with published **0.3.0** and this source.
**Unreleased 0.4.0 default change:** the next SDK release will use
`https://api.flowmark.dev` in every environment when `apiUrl`/`FLOWMARK_API_URL`
is omitted. Hosted users will need only `FLOWMARK_API_KEY`. Local and staging
users must supply their API origin when upgrading. Published 0.3.0 still requires
an explicit production URL and defaults to localhost outside production.

Server only. Never put the write key in `NEXT_PUBLIC_*` or a browser bundle.
`FLOWMARK_API_URL` is the API origin, not `/v1/events`. The SDK does not load
.env files. Missing/blank keys or invalid URLs throw `FlowmarkConfigError`:
immediately in Node, at the first workflow/settlement call in Next. Next client
construction is inert and safe during builds without credentials.

```ts
import { flowmark } from "./flowmark"

export function completeCheckout(orderId: string) {
  return flowmark.workflow(
    "checkout.order",
    async (flow) => {
      flow.step("payment-captured")
      const shipment = await flow.operation("create-shipment", () =>
        createShipment(orderId),
      )
      flow.done({ outcome: "complete", result: { shipmentId: shipment.id } })
      return shipment
    },
    { properties: { orderId } },
  )
}
```

## Next.js and scripts in the same application

Let each entry point own its client. Shared business logic accepts only the
workflow-capable dependency, with no runtime-specific imports:

```ts
import type { FlowmarkClient } from "@flowmarkdev/node"

export function importInvoices(flowmark: Pick<FlowmarkClient, "workflow">) {
  return flowmark.workflow("invoice.import", async (flow) => {
    const result = await flow.operation("save-invoices", () => saveInvoices())
    flow.done({
      outcome: result.rejected > 0 ? "partial" : "complete",
      result: { imported: result.imported, rejected: result.rejected },
    })
    return result
  })
}
```

`saveInvoices` is existing application code. Callback workflows are new in
**unreleased 0.4.0**: normal return requests completion; an unhandled throw records
`workflow_failed` and preserves the original rejection. No retries, scheduling or
client shutdown are added. Explicit `done`/`fail` choose business meaning; call a
terminal marker at the final decision point. Use the manual marker API when a
process continues in another invocation. Operation callbacks accept synchronous
values or Promises and always return a Promise. Always await measured work.

The Route Handler passes its Next client to the function. The CLI passes its
Node client to the same function, then drains:

```ts
const flowmark = createFlowmark() // Node entry point
try {
  await importInvoices(flowmark)
} finally {
  try {
    await flowmark.shutdown()
  } catch (error) {
    console.error("Flowmark delivery failed", error)
  }
}
```

The catch makes delivery failure visible without masking a business exception.
The SDK installs no signal handlers. Long-lived clients flush at a job boundary
and shut down only after all their work finishes. Shared business logic imports
neither runtime client: no request-scope probing, exception matching, mutable
fallback clients or custom lifecycle adapters are needed.

## Markers

| Method                                           | Role                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------ |
| `createFlowmark()`                               | Shared client                                                      |
| `defineConfig()`                                 | Typed config object; does not load env or create a client          |
| `workflow(name, options?)`                       | Start a run, or continue one with the same name and `id`           |
| `defineWorkflow<Context, Result, Outcome>(name)` | Typed handle; `.start()` uses the same client lifecycle            |
| `flow.runId`                                     | This execution's id                                                |
| `flow.step(name)`                                | Instant milestone                                                  |
| `flow.operation(name, fn)`                       | Timed work; the original rejection is preserved                    |
| `flow.progress({ completed, total?, unit? })`    | Absolute snapshot                                                  |
| `flow.report(snapshot)`                          | Absolute non-final business result                                 |
| `flow.error({ code, handled, retryable? })`      | Non-terminal observation                                           |
| `flow.setProperties(props)`                      | Shallow context amendment until a terminal event                   |
| `flow.expect(name, options)`                     | Declare expected evidence; does not wait or perform work           |
| `flow.done({ outcome?, result? })`               | End the run as completed                                           |
| `flow.fail({ code, outcome?, result? })`         | End the run as failed                                              |
| `resolveExpectation` / `cancelExpectation`       | Settle an expectation, including after the run ends                |
| `deliveryHealth()`                               | Node and browser cumulative local counters; no payloads or secrets |
| `flush()` / `shutdown()`                         | Node and browser delivery drain                                    |

`workflow()` options: `id`, `properties`, `environment`, `release`,
`correlationId`, `parentRunId`, and `retryOf`.

`defineConfig()` returns the object you pass in. Import it and pass it to
`createFlowmark(config)` if you want a typed config module. The SDK does not
load `flowmark.config.ts` automatically.

## Results and outcomes

`outcome` is an optional case-sensitive code matching
`^[a-z][a-z0-9_-]{0,63}$`. It is independent of technical completion or
failure. Absence means unreported. Fields inside `result` are ordinary
application data.

```ts
flow.done({ outcome: "partial", result: { imported: 988, skipped: 12 } })
flow.fail({
  code: "CRM_TIMEOUT",
  outcome: "partial",
  result: { updated: 80 },
})
```

`flow.report(snapshot)` replaces the whole previous non-final snapshot.
Omitted fields become unknown. A report never becomes the final result, never
changes progress, and never sets the business outcome. Post-terminal reports
are ignored. Latest means latest accepted by the server.

```ts
flow.report({ imported: 6000, rejected: 50 })
flow.report({ imported: 9600 })
flow.done({ outcome: "partial", result: { imported: 9600, rejected: 100 } })
```

Optional `defineWorkflow()` binds context, result, and outcome types. Creating
the definition emits nothing. Types are erased and do not register dashboard
declarations or replace runtime validation.

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

Result and property objects are JSON-safe and bounded: depth 5, 128 keys,
128-character keys, 2,048-character strings, and 16 KiB per object. Invalid
values use instrumentation diagnostics. They do not throw into application
work.

Dashboard declarations, reference search, and outcome aggregates are configured
on the server. The SDK does not upload those declarations. Runs select a
presentation revision with `properties.definitionRevision` at start.

## Same run, later request

Persist `flow.runId`, or pass your own execution id. A later call with the same
workflow name and `id` continues that run. Call `done()` or `fail()` only when
the whole process is finished. Repeated starts do not amend the original
context, release, or environment. Use `setProperties()` until the run records
a terminal event, including while completion waits for open operations.
Durable entity ids belong in `properties`, not in the run id.

```ts
const flow = flowmark.workflow("expedition.run", { id: expedition.id })
flow.step("draft-started")
```

Related work is a new `workflow()` plus `correlationId` and/or `parentRunId`
that your code passes explicitly. Nothing is propagated automatically. A
`retryOf` reference starts a separate run with a new id.

## Expectations and attempts

These options are explicit. Deploy a server that acknowledges the capability
before enabling them. Older servers surface diagnostics and failed drains
rather than silently storing the metadata.

```ts
const flow = flowmark.workflow("booking.submit")
const confirmation = flow.expect("provider-response", {
  id: confirmationId,
  within: "5m",
})
flow.done({ outcome: "submitted", result: { submitted: 1 } })

flowmark.resolveExpectation(confirmation, {
  outcome: "no-availability",
  result: { reserved: 0 },
})
```

An expectation declares a server-observed deadline. Resolving it does not
verify business success, reopen the run, or change the final result. The
reference is not a credential. Direct browser expectations stay untrusted.
The generic server-key proxy rejects expectation events.

```ts
const first = flow.operation("push-to-crm", {
  attempt: { groupId: "batch-42", number: 1 },
})
first.fail({ code: "CRM_UNAVAILABLE", retryable: true })

await flow.operation("push-to-crm", () => pushToCrm(), {
  attempt: { groupId: "batch-42", number: 2 },
  mapError: () => ({
    code: "CRM_UNAVAILABLE",
    message: "CRM temporarily unavailable",
    retryable: true,
  }),
})
```

Attempt groups are scoped to one run and operation name. `mapError` is
synchronous and explicitly selects failure fields for that callback. In 0.4.0,
an unmapped callback failure records only `{ code: "operation_failed" }`; the
original exception is never inspected or copied. Published 0.3.0 still copies
structured fields or `Error.message`, so keep `mapError` when using that release. Only
validated `code`, optional `message`, and optional `retryable` are sent.
`retryable` describes the failure. Flowmark does not retry the work.

## Delivery

The queue holds at most 1,000 pending events. Progress and report admission
stops at 900 pending events. Queued events are not evicted. Critical overload
can still drop new markers.

Progress is recorded per call unless you opt in:

```ts
createFlowmark({ delivery: { progress: "latest" } })
```

That option replaces adjacent unsent progress for one handle with the latest
validated snapshot. `report()` stays per call.

`flush()` and `shutdown()` reject with at most 20 original `failures`, plus
`failureCount` and `omittedFailureCount`. Node and browser
`deliveryHealth()` exposes pending counts and cumulative coalesced, dropped,
and failed counters. Next.js accepts `onDeliveryHealth` on `createFlowmark()`
instead of a drain method.

`operation()` records duration and rethrows the original error. It does not
fail the run. Only `fail()` makes the run failed. The first terminal event
accepted by the server wins. Open operations delay completion. `fail()` can
supersede a pending `done()`.

## Further reading

- [Quickstart](https://docs.flowmark.dev/docs/sdk)
- [Completion and outcomes](https://docs.flowmark.dev/docs/reference/completion)
- [Reports](https://docs.flowmark.dev/docs/reference/report)
- [Typed workflows](https://docs.flowmark.dev/docs/reference/define-workflow)
- [Attempts](https://docs.flowmark.dev/docs/reference/attempts)
- [Expectations](https://docs.flowmark.dev/docs/reference/expectations)
- [Delivery](https://docs.flowmark.dev/docs/delivery)
- [Next.js](https://docs.flowmark.dev/docs/nextjs)
- [Node.js scripts and shared business logic](https://docs.flowmark.dev/docs/nodejs)

Runnable loopback examples live in the repository under `packages/sdk/examples/`.

## License

Copyright 2026 Martin Persson. Licensed under [Apache-2.0](./LICENSE), including
the `@flowmarkdev/core` dependency. The platform's FSL license does not apply to
this SDK. Previously distributed MIT versions retain their MIT rights.

## Public run reads

SDK **0.3.0** adds the `@flowmarkdev/node/read` subpath, providing
`createFlowmarkReadClient`, `FlowmarkReadClient`, `FlowmarkReadError` and the public
read DTO types. See the [run read guide](https://docs.flowmark.dev/docs/public-reads) for
read-key issuance, API URL configuration, limits and the runnable CLI. Both the SDK
publication and the accepting API deployment must be complete before using these
reads. Existing ingestion exports are unchanged.

`client.readPeriod` supports the same explicit technical-period selection used
by Studio/MCP. See [period comparisons](https://docs.flowmark.dev/docs/public-reads) for
full-population counts, coverage and unsupported filters. Both read methods
share the same scoped transport, auth/error boundary and runnable consumer.
