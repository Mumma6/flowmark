# @flowmark/node

Create a Flowmark client once, then add workflow markers to ordinary application
code. No transport objects or Effect knowledge are needed.

## Configuration

`defineConfig()` is a pure typed identity helper. It provides autocomplete,
hover documentation, and literal type inference while rejecting unknown
options, then returns the same object unchanged. It does not read the
environment, validate credentials, create a client, or start delivery.

You may export it from `flowmark.config.ts`, but that filename is only a
convention: import the config explicitly and pass it to `createFlowmark(config)`.
Flowmark does not discover files automatically. Inline
`createFlowmark({ ... })` remains supported for small integrations.

For server code, import `defineConfig` from `@flowmark/node` or
`@flowmark/node/next`. Server configuration can omit credentials to use
`FLOWMARK_API_KEY` and `FLOWMARK_API_URL`; validation stays at the client boundary.
Browser code must use `@flowmark/node/browser` and public browser keys, never
secret server credentials. Keep server and browser configuration in separate
modules when an application uses both.

## Next.js

```ts
// lib/flowmark.ts (ordinary server-side module, not a config-file convention)
import { createFlowmark } from "@flowmark/node/next"

export const flowmark = createFlowmark()
```

Set `FLOWMARK_API_KEY` in your server environment. For this repository's local
demo it is `fm_demo_write_local_only`; the API must explicitly enable demo mode.
`FLOWMARK_API_URL` defaults to `http://localhost:3003` in development. Set it to
your API origin when it is not the development default; production requires
an explicit URL.

```ts
import { flowmark } from "./lib/flowmark"

const flow = flowmark.workflow("checkout")
flow.step("payment-created")
flow.error({
  code: "inventory-retry",
  message: "A retry was scheduled",
  retryable: true,
  handled: true,
})
flow.done({ result: { receiptId: "receipt_123" } })
// Or: flow.fail({ code: "payment-declined", retryable: false })
```

The Next.js entry point handles delivery automatically via `after()`. Use it
inside Route Handlers or Server Actions, not in Client Components or middleware.
Each workflow gets an independent run ID. Pass business identifiers as optional
properties: `flowmark.workflow("checkout", { properties: { orderId } })`.
Do not put passwords, tokens, payment details, or unnecessary personal data in
properties. Supplying `id` overrides the generated **run** ID; it must be unique
per execution, not reused for every action on the same todo/order.

## Plain Node.js

```ts
import { createFlowmark } from "@flowmark/node"

const flowmark = createFlowmark()
const flow = flowmark.workflow("checkout")
flow.step("order-created")
flow.done({ result: { orderId: "order_123" } })

// At the process/job boundary, before exit:
await flowmark.shutdown()
```

Long-lived processes can `await flowmark.flush()` without closing the client.
These promises reject when delivery fails; individual `step`, `done`, and `fail`
calls never propagate telemetry delivery failures into business logic. The
optional `onInstrumentationError` callback receives typed failures; otherwise
a warning is logged. Invalid configuration fails explicitly when a client is
created (or when the first workflow is created by the Next.js entry point).

## Workflow context, errors, and results

All client surfaces (`@flowmark/node`, `@flowmark/node/browser`, and
`@flowmark/node/next`) expose the same `Flow` methods:

```ts
const flow = flowmark.workflow("checkout", {
  properties: { orderId: "order_123" },
  environment: "production",
  release: "2026.10.23",
  correlationId: requestCorrelationId,
  parentRunId: upstreamRunId,
})

flow.step("payment-authorized", { properties: { provider: "stripe" } })
flow.setProperties({ region: "eu-west" }) // appends a context amendment
flow.error({ code: "inventory-retry", retryable: true, handled: true })
flow.done({ result: { receiptId: "receipt_123" } })
// Or terminate with flow.fail({ code: "payment-declined", retryable: false })
```

`step(name, { properties })` attaches JSON-safe detail to that step.
`setProperties(properties)` appends a shallow context amendment; it does not
rewrite earlier events. `error({ code, message?, retryable?, handled })` records
an error without terminating the run, including when `handled` is false. Only
`fail({ code, message?, retryable?, result? })` marks the run failed. `code`
is required. The optional `result` is the same bounded business summary
accepted by `done()`. Structured codes are limited to 128 characters and
messages to 2,048 characters.
`done({ result })` records an optional result object. Terminal calls are
idempotent. The first `done()` request wins: when operations remain open, the
run waits and completes automatically after the last open operation closes,
preserving the first request's result. Other run markers after that request are
ignored, but already-open operations may still close. An explicit `fail()`
supersedes a pending completion.

Start and per-run options accept optional `environment` and `release`; per-run
values override defaults passed to `createFlowmark({ environment, release })`.
Properties and results are bounded JSON-safe objects: maximum five nested
levels, 128 keys total, 128 characters per key, 2,048 characters per string,
and 16 KiB UTF-8 JSON per object. Non-finite numbers, `undefined`, functions,
symbols, bigints, class instances (including `Error`), cycles, and sparse
arrays are rejected by the shared core event schema. Never place secrets or
unnecessary personal data in them.

## Linking runs explicitly

`flow.runId` exposes this run's SDK identifier immediately after creation.
`workflow()` accepts optional per-run `correlationId` and `parentRunId`:

```ts
const browserFlow = browserFlowmark.workflow("browser.checkout")
await fetch("/api/checkout", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-flowmark-run-id": browserFlow.runId,
  },
  body: JSON.stringify({ cart }),
})

// In the server handler, explicitly read the app-propagated ID:
const serverFlow = serverFlowmark.workflow("checkout", {
  correlationId: `checkout:${applicationRequestId}`,
  parentRunId: request.headers.get("x-flowmark-run-id") ?? undefined,
})
```

No identifiers or headers are propagated automatically. `correlationId` is a
bounded, non-empty string (maximum 128 characters) for grouping runs that your
application associates; it is not a distributed trace ID and does not prove
causation. `parentRunId` is the parent flow's external `runId` string, bounded
to 200 characters—not the dashboard's internal UUID. It may not resolve if the
parent was not ingested into the same project; duplicate external IDs across
workflows can yield multiple parent matches. Do not put secrets or personal
data in either identifier. Browser-provided IDs are untrusted reports, not
authoritative identity or proof of a business action.

The `run.related({ id })` read procedure accepts the dashboard's internal run
UUID and returns `{ parentMatches, related }`. Both lists are scoped to the
authorized project; `related` contains all other runs with the same explicit
correlation ID (not only the latest 100). Results describe declared links, not
a causal or OpenTelemetry trace tree.

## Measured operations and progress

Use operations for separately named units of work inside a run. Each operation
gets its own ID and start event; the terminal event records elapsed duration
measured with a monotonic clock, not by subtracting event timestamps. Sibling
operations may overlap and complete in any order:

```ts
const payment = flow.operation("charge-payment", {
  properties: { provider: "stripe" },
})
const stock = flow.operation("reserve-stock")
payment.done()
stock.fail({ code: "out-of-stock", retryable: false })
```

For Promise-based work, the callback overload closes the operation automatically.
It returns the callback's result unchanged, and on rejection records the thrown
structured failure or `operation_failed` plus an `Error` message, then rethrows
the exact original cause. It does not fail the workflow:

```ts
const receipt = await flow.operation("charge-payment", () => chargeCustomer())
```

Call `flow.done()` when the workflow is ready to finish. If operations remain
open, completion is deferred and emitted automatically when the final operation
calls `done()` or `fail()`; the first completion request's result is preserved,
and a second `done()` call is ignored. The workflow remains open if an operation
is never closed. `flow.fail()` supersedes pending completion as an explicit
terminal workflow failure; subsequent operation markers are ignored.
Operations are independent siblings; nested operation parenting is not part of
this API.

Report absolute progress snapshots as work advances:

```ts
flow.progress({ completed: 125, total: 500, unit: "rows" })
```

`completed` and the optional `total` must be nonnegative safe integers, and
`completed` cannot exceed `total` when supplied. `unit` is an optional
non-empty string up to 64 characters. Invalid snapshots are rejected through
the SDK's instrumentation diagnostics and are never silently capped. Each call
is persisted as a snapshot; Flowmark does not aggregate, deduplicate, or
coalesce progress updates.

## Browser / frontend

Use the browser entry point in Client Components or other browser code. It has
no Node.js/Next.js imports and never reads server environment variables.
The existing package name is still `@flowmark/node`.

For direct delivery without your own backend:

```ts
// flowmark.config.ts (public settings only)
import { defineConfig } from "@flowmark/node/browser"

export default defineConfig({
  publicKey: "fm_browser_...",
  apiUrl: "http://localhost:3003",
})
```

```ts
// lib/flowmark.ts
import { createFlowmark } from "@flowmark/node/browser"
import config from "../flowmark.config"

export const flowmark = createFlowmark(config)
```

This works in ordinary React/Vite applications without a provider or Next.js.
It sends directly to `POST /v1/browser-events` and requires a running Flowmark
API plus a public browser key whose allowed-origins list includes the exact
frontend origin. Public keys are intentionally visible and cannot read
dashboard data or use private server ingestion. The API limits each browser key
to 120 requests per minute, shared across visitors using that key. Browser
telemetry is untrusted: origin restrictions and a public key do not prove that
a reported business action actually happened.

The repository's development browser key is `fm_demo_browser_local_only`. It
is accepted only when the API runs with `FLOWMARK_DEMO_MODE=true`, and its
allowed origins are local development origins on ports 3004 and 5173. These
are local development credentials, not keys for real customer data. There is no
hosted Flowmark API; configure a self-hosted API origin.

### Optional same-origin proxy

If you prefer keeping all credentials on your own backend, omit the public key
and use a same-origin proxy instead:

```ts
// app/flowmark.ts
"use client"

import { createFlowmark } from "@flowmark/node/browser"

export const flowmark = createFlowmark()
```

In an event handler:

```ts
const flow = flowmark.workflow("checkout.ui")
flow.step("payment-form-submitted")
// Your application code
flow.done() // Or flow.fail({ code: "payment-failed" })
```

Add a same-origin server route once:

```ts
// app/api/flowmark/route.ts
import { createFlowmarkProxy } from "@flowmark/node/next/proxy"

export const POST = createFlowmarkProxy()
```

Set `FLOWMARK_API_KEY` and, when required, `FLOWMARK_API_URL` **only on the
server**, never in `NEXT_PUBLIC_*` variables. The proxy adds the write key and
forwards validated events to Flowmark. Frontend requests contain no Flowmark
credentials. Next.js is not required by the browser client itself.

The default proxy path is `/api/flowmark`. To place the handler elsewhere,
configure `createFlowmark({ proxyPath: "/api/telemetry" })` in the browser.
Only same-origin absolute paths are accepted.

**Production access control:** same-origin checks prevent cross-site browser
submissions, but do not authenticate users or stop scripts/bots forging headers.
Protect this write-capable route with your own session checks and rate limits:

```ts
export const POST = createFlowmarkProxy({
  authorize: async (request) => {
    // Your existing session/rate-limit check; return false to reject.
    return await canRecordWorkflow(request)
  },
})
```

The demo intentionally has no login and exposes only the shared development
project. The proxy does not accept a destination, project, or write key from the
browser, limits input to 64 KiB, and preserves event IDs for retry
deduplication. Browser data is untrusted telemetry, not authoritative proof
that a payment or other business action succeeded.

Client creation is SSR-safe; create workflows only in browser event handlers
or effects, never during render. Delivery starts automatically. `flush()` is
available when you need to wait (for example before full-page navigation);
`shutdown()` drains and closes a client when it is no longer needed.
Requests use fetch keepalive, but browser shutdown, offline operation, and
keepalive size limits can still lose events. No durable offline queue or
unload-delivery guarantee is implemented.

## Delivery

Internally, Effect handles validation, per-run ordering, cancellation and HTTP.
HTTP requests use `@effect/platform`'s injectable `HttpClient`, with scoped
request cleanup rather than a custom `fetch`/Promise implementation.
The SDK adds event IDs, authenticates requests, uses a three-second timeout per
attempt and retries network errors, HTTP 429 and 5xx up to twice. The API
deduplicates retried events. Pending delivery is bounded to 1,000 events per
client; overflow is logged and causes `flush`/`shutdown` to reject.

Delivery is best-effort, not durable or exactly-once: no disk-backed queue,
background worker or batching is implemented. Abrupt process termination can
lose pending data. The Next.js adapter waits within the platform's after-response
execution budget; configure a suitable request duration.

`MemoryTransport` and the low-level `workflow(name, { transport, id })` API remain
available for SDK tests/custom integrations, not ordinary application setup.

## Internal structure

- `types/`, `errors/`, `config/`: public contracts, tagged failures, and
  Schema-validated settings with internally redacted credentials.
- `features/workflows/workflow-engine.ts`: lazy workflow operations composed with `Effect.fn`,
  `Clock`, and `Ref`; no framework dependencies.
- `features/delivery/delivery-queue.ts`: an injectable delivery queue with scoped `FiberSet`
  ownership, per-run ordering, diagnostics, and drain/shutdown effects.
- `features/delivery/ports/workflow-transport.ts`: the transport service
  interface and dependency tag.
- `features/delivery/adapters/http.ts`: an HTTP transport layer depending on
  `HttpClient` and settings. It shares `http-transport.ts` with the browser entry
  point. Tests can supply an HTTP client without making network requests.
- `features/delivery/adapters/memory-transport.ts`: an in-memory transport for
  tests/custom integrations.
- `adapters/next.ts`: the only Next.js integration, exposed as
  `@flowmark/node/next`; it binds delivery to `after()` without leaking Next.js
  into workflow features.
- `client/`: layer composition, managed runtime ownership, and the explicit
  server configuration boundary. `runtime.ts` owns shared managed runtime
  execution and exposes ordinary TypeScript/Promise methods.
- `browser/`, `adapters/proxy.ts`: a credential-free browser entry and a
  server-only same-origin proxy.

The internal services expose typed Effect operations and do not run them.
Only the client boundary owns execution. `shutdown()` drains outstanding work
and disposes the managed runtime, including its resource scope.
