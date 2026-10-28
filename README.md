<p align="center">
  <img src="docs/assets/flowmark-mark.svg" width="72" height="72" alt="Flowmark" />
</p>

<h1 align="center">flowmark.</h1>

<p align="center">
  <strong>Understand every execution. Discover what matters across them.</strong>
</p>

<p align="center">
  Open source · Workflow observability · TypeScript
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowmarkdev/node"><img alt="npm" src="https://img.shields.io/npm/v/@flowmarkdev/node?color=b9f597&label=npm&labelColor=0d1311" /></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-b9f597?labelColor=0d1311" /></a>
  <a href="https://flowmark.dev"><img alt="flowmark.dev" src="https://img.shields.io/badge/flowmark.dev-0d1311" /></a>
</p>

Flowmark is workflow observability for processes your application already
runs. Mark a named process in ordinary TypeScript. Each execution becomes
evidence you can investigate — milestones, operations, progress, errors, and
the result your code reported — and many executions become a picture of what
that process is accomplishing.

Flowmark observes. It does not execute, schedule, or retry your work.

## Install

```sh
npm i @flowmarkdev/node
```

```ts
// Next.js Route Handler / Server Action
import { createFlowmark } from "@flowmarkdev/node/next"
export const flowmark = createFlowmark()
```

```ts
// Node worker or long-lived server
import { createFlowmark } from "@flowmarkdev/node"
export const flowmark = createFlowmark()
```

```bash
FLOWMARK_API_KEY=<project write key>
FLOWMARK_API_URL=https://api.flowmark.dev
```

```ts
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

## Product

|           |                                                                        |
| --------- | ---------------------------------------------------------------------- |
| Landing   | [flowmark.dev](https://flowmark.dev)                                   |
| Dashboard | [app.flowmark.dev](https://app.flowmark.dev)                           |
| Docs      | [docs.flowmark.dev](https://docs.flowmark.dev)                         |
| API       | [api.flowmark.dev](https://api.flowmark.dev)                           |
| npm       | [`@flowmarkdev/node`](https://www.npmjs.com/package/@flowmarkdev/node) |

Sign up on the dashboard to create a project and a write key. Password reset
is not available yet.

## What you get

- TypeScript SDK for Node.js, Next.js, and the browser
- Validated, project-scoped ingestion into PostgreSQL
- Dashboard: volume, success rate, duration, trends, slowest operations,
  failure codes, run timelines, and peer comparison
- Explicit links between related runs via ids you pass

## Local development

Node.js 20.19+ (24 LTS recommended) and pnpm 10.

```sh
pnpm install
pnpm dev:setup
# Set DATABASE_URL in apps/server/.env.local to a loopback Postgres database.
pnpm db:setup
pnpm dev
```

`pnpm dev` starts the apps and watches the SDK. See
[development](./docs/development.md) for the full local pipeline. Open the
dashboard at `http://127.0.0.1:3001`.

`apps/dev-harness` and `apps/internal-docs` are loopback-only. Do not deploy
them.

## Repository

| Path             | Purpose                         |
| ---------------- | ------------------------------- |
| `packages/sdk`   | `@flowmarkdev/node`             |
| `packages/core`  | Shared event contracts          |
| `packages/api`   | Use cases and ports             |
| `packages/db`    | Schema, migrations, persistence |
| `packages/ui`    | Shared UI                       |
| `apps/server`    | API                             |
| `apps/dashboard` | Signed-in UI                    |
| `apps/web`       | Landing                         |
| `apps/docs`      | Customer docs                   |

## Contributing

- [Development](./docs/development.md)
- [Architecture](./docs/architecture.md)
- [Decisions](./docs/decisions/)

License: [MIT](./LICENSE).
