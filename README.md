<p align="center">
  <img src="docs/assets/flowmark-mark.svg" width="72" height="72" alt="Flowmark" />
</p>

<h1 align="center">flowmark.</h1>

<p align="center">
  <strong>Understand every execution. Discover what matters across them.</strong>
</p>

<p align="center">
  Open source · Workflow observability · TypeScript SDK
</p>

<p align="center">
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-b9f597?labelColor=0d1311" /></a>
  <a href="https://flowmark.dev"><img alt="flowmark.dev" src="https://img.shields.io/badge/flowmark.dev-0d1311" /></a>
</p>

Mark a process your application already runs. Flowmark records the execution
— milestones, operations, progress, errors, and the result the application
reports — so you can investigate one run and see what changed across them.

```ts
const flow = flowmark.workflow("checkout.order", { properties: { orderId } })

try {
  await capturePayment(orderId)
  flow.step("payment-captured")
  const shipment = await flow.operation("create-shipment", () =>
    createShipment(orderId),
  )
  flow.done({ result: { shipmentId: shipment.id } })
  return shipment
} catch (error) {
  flow.fail({
    code: "CHECKOUT_FAILED",
    result: { paid: true, shipped: false },
  })
  throw error
}
```

```mermaid
flowchart TB
  start["flowmark.workflow(name, options)"] --> flow[Flow]
  flow --> runId[runId]
  flow --> during[During the run]
  flow --> terminal[Terminal - first wins]
  during --> step["step(name, properties?)"]
  during --> operation["operation(name, properties?)"]
  during --> progress["progress snapshot"]
  during --> error["error({ code, handled })"]
  during --> setProperties["setProperties(properties)"]
  operation --> handle["handle.done() / handle.fail({ code })"]
  operation --> callback["or callback Promise"]
  terminal --> done["done({ result? })"]
  terminal --> fail["fail({ code, result? })"]
  fail -.->|can supersede| done
```

`done()` or `fail()` ends the run. Attach a bounded result on either —
including partial work on failure. A handled error or a failed operation stays
on the timeline until you complete or fail the run.

## What you get

- A TypeScript SDK for Node.js, Next.js, and the browser
- An API that validates and stores workflow events
- A dashboard with volume, success rate, median and p95 duration, trends,
  slowest operations, failure codes, and run comparison
- Explicit links between related runs via IDs you pass

## Status

Instrument a process, ingest events, sign in to the dashboard, and inspect a
run. The reference deployment is live at the links below. The SDK is not on
npm yet. Key management is in the dashboard.

- Product: [flowmark.dev](https://flowmark.dev)
- SDK reference (this repo): [`apps/docs`](./apps/docs)
- Purpose: [product vision](./PRODUCT-VISION.md)

## Local development

Node.js 20.19+ (24 LTS recommended) and pnpm 10.

```sh
pnpm install
pnpm dev:setup
# Set DATABASE_URL in apps/server/.env.local to a running development database.
pnpm db:setup
pnpm dev
```

`pnpm dev` starts the apps and watches SDK/core. Start PostgreSQL and apply
migrations separately. For a working local pipeline, follow the
[development guide](./docs/development.md#local-demo-with-postgresql), then
open the dashboard at `http://127.0.0.1:3001`.

`apps/dev-harness` and `apps/internal-docs` are loopback-only. Do not deploy
them.

## Repository

| Path | Purpose |
| --- | --- |
| `packages/sdk` | `@flowmark/node` — Node, Next.js, and browser SDK |
| `packages/core` | Workflow domain and event contract |
| `packages/api` | Use cases, ports, and adapters |
| `packages/db` | Schema, migrations, and persistence |
| `packages/ui` | Shared UI primitives |
| `apps/server` | HTTP/tRPC shell |
| `apps/dashboard` | Operations dashboard |
| `apps/web` | Product landing |
| `apps/docs` | Customer documentation |
| `docs/` | Contributor architecture, decisions, and product guides |

## Contributing

- [Development commands](./docs/development.md)
- [Infrastructure](./docs/infrastructure.md)
- [Architecture](./docs/architecture.md)
- [Agent guidelines](./AGENTS.md)
- [Development roadmap](./NEXT-PHASE-PLAN.md)

License: [MIT](./LICENSE).
