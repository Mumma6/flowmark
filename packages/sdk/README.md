# @flowmarkdev/node

Flowmark observes a process your app already runs. It does not execute,
schedule, or retry that work. There is no `track()`, `span()`, or `metric()`
API. Use only the methods below.

This README is the implementation contract. Read it before adding markers.

## Implement

### 1. Pick the entry

| Code | Import |
| --- | --- |
| Next.js Route Handler or Server Action | `createFlowmark` from `@flowmarkdev/node/next` |
| Node worker, script, or long-lived server | `createFlowmark` from `@flowmarkdev/node` |
| Browser / Client Component | `createFlowmark` from `@flowmarkdev/node/browser` |

Create **one** shared client in a server-only module. Do not construct a new
client per file. Do not import the Node or Next entry in Client Components.
`@flowmarkdev/node/next` drains via `after()` — do not call it from middleware,
render, or the browser.

```ts
// lib/flowmark.ts — Next.js server
import { createFlowmark } from "@flowmarkdev/node/next"
export const flowmark = createFlowmark()
```

```ts
// lib/flowmark.ts — Node
import { createFlowmark } from "@flowmarkdev/node"
export const flowmark = createFlowmark()
```

### 2. Server environment

Set these on the server only. Never `NEXT_PUBLIC_*`. Never a browser bundle.

```bash
FLOWMARK_API_KEY=<project server write key>
FLOWMARK_API_URL=https://your-flowmark-api.example
```

`FLOWMARK_API_URL` is the API origin, not `/v1/events`. In development it
defaults to `http://localhost:3003`. Production requires an explicit origin.

### 3. Public API

This is the entire application surface:

- `createFlowmark()`
- `flowmark.workflow(name, { id?, properties?, environment?, release?, correlationId?, parentRunId? })`
- `flow.runId`
- `flow.step(name, { properties? })`
- `flow.operation(name, callback)` or `handle.done()` / `handle.fail({ code })`
- `flow.progress({ completed, total?, unit? })`
- `flow.error({ code, handled, retryable? })`
- `flow.setProperties(properties)`
- `flow.done({ result? })` / `flow.fail({ code, result? })`
- `flowmark.flush()` / `flowmark.shutdown()` — Node only; Next.js drains itself

Do not invent wrappers, extra clients, or methods.

### 4. One request

Start, mark, then finish in the same handler. Keep the function's return and
thrown error. Telemetry failures must not change business behavior.

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

### 5. Same process, later request

Pass the same workflow name and `id`. Persist `flow.runId` (or your own
execution id) on the application record. A second `started` is ignored.

**Do not call `done()` or `fail()` until the whole process is finished.**
If this handler is only the start, record a step and return.

```ts
// POST /expeditions — start
const flow = flowmark.workflow("expedition.run", { id: expedition.id })
flow.step("draft-started")

// POST /expeditions/:id/claim — later
const flow = flowmark.workflow("expedition.run", { id: expedition.id })
await flow.operation("claim-battle", () => claimBattle(expedition.id))
flow.step("battle-claimed")
flow.done({ result: { battlesWon: 2 } })
```

Do not reuse a durable entity id that outlives one execution (the same order
across retries or later jobs). Put those in `properties`.

### 6. A different process

New `workflow()` plus `correlationId` and/or `parentRunId`. Nothing is
propagated automatically — pass the ids through your own payload.

### 7. Properties and results

Small JSON-safe objects: counts, status enums, opaque ids you already persist.
No secrets, emails, tokens, request bodies, raw `Error`s, or unnecessary
personal data.

Limits: depth 5, 128 keys, 128-character keys, 2,048-character strings, 16 KiB
per object.

## Configuration

`defineConfig()` is a typed identity helper. It does not read the environment
or create a client. A `flowmark.config.ts` file is only a convention — import
it and pass it to `createFlowmark(config)`. Flowmark does not discover files.

Server config may omit credentials and use `FLOWMARK_API_KEY` /
`FLOWMARK_API_URL`. Browser code must use `@flowmarkdev/node/browser` and a public
browser key, never the server write key. Keep server and browser clients in
separate modules.

## `done()`, `fail()`, and operations

`done({ result? })` and `fail({ code, result? })` end the run. The first
terminal wins. If operations are still open, completion waits until they close.
`fail()` can supersede a pending `done()`. Later markers are ignored.

`error({ code, handled, retryable? })` stays on the timeline and does not end
the run. Only `fail()` makes the run failed.

`operation(name, callback)` measures duration, returns the callback result, and
rethrows the original rejection. It does not fail the workflow.

```ts
const receipt = await flow.operation("charge-payment", () => chargeCustomer())
flow.progress({ completed: 125, total: 500, unit: "rows" })
```

Node processes must `await flowmark.shutdown()` before exit. Long-lived
workers can `await flowmark.flush()`. Those promises reject on delivery
failure; `step` / `done` / `fail` never throw delivery errors into app code.

## Browser

`@flowmarkdev/node/browser` never reads server env. Direct delivery needs a public
browser key and `POST /v1/browser-events`. Or omit the key and proxy through
`createFlowmarkProxy` from `@flowmarkdev/node/next/proxy` with `FLOWMARK_API_KEY`
only on the server.

Browser telemetry is untrusted. Create workflows in event handlers or effects,
not during render.

## Delivery

Best-effort, in memory, not a durable queue. The API deduplicates retries.
`MemoryTransport` and `workflow(name, { transport, id })` are for tests, not
ordinary setup.
