<p align="center">
  <img src="docs/assets/flowmark-mark.svg" width="72" height="72" alt="Flowmark" />
</p>

<h1 align="center">flowmark.</h1>

<p align="center">
  <strong>Understand what your software actually does.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowmarkdev/node"><img alt="npm" src="https://img.shields.io/npm/v/@flowmarkdev/node?color=b9f597&label=npm&labelColor=0d1311" /></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-b9f597?labelColor=0d1311" /></a>
  <a href="https://flowmark.dev"><img alt="flowmark.dev" src="https://img.shields.io/badge/flowmark.dev-0d1311" /></a>
</p>

Flowmark is an open-source process-intelligence platform for people and AI
agents. Instrument the processes your application already runs, collect execution
evidence, and understand technical and reported business outcomes over time.

Today, the TypeScript SDK and web interface support workflow investigation,
related executions, progress, outcomes, confirmations and historical business
analytics. Your application keeps ownership of execution.

**Product 1.0 direction:** Flowmark Platform supplies the programmable foundation;
Flowmark Studio brings it into a contextual investigation workspace; Flowmark
Everywhere carries it into agents, custom tools and portable interfaces. These
are dimensions of one product. The unified Studio, delegated MCP access, saved
investigations and portable agent UI are planned, not current availability claims.

## Getting started

Requires Node.js 20.19 or newer.

```sh
npm i @flowmarkdev/node
```

Create one shared client. Keep the write key on the server. Never place it in
`NEXT_PUBLIC_*` or a browser bundle. `FLOWMARK_API_URL` is the API origin, not
a path such as `/v1/events`.

```bash
FLOWMARK_API_KEY=<project write key>
FLOWMARK_API_URL=https://api.flowmark.dev
```

```ts
// Next.js Route Handler or Server Action
import { createFlowmark } from "@flowmarkdev/node/next"

export const flowmark = createFlowmark()
```

```ts
// Node.js worker or long-lived server
import { createFlowmark } from "@flowmarkdev/node"

export const flowmark = createFlowmark()
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
    flow.done({
      outcome: "complete",
      result: { shipmentId: shipment.id },
    })
    return shipment
  } catch (error) {
    flow.fail({ code: "CHECKOUT_FAILED" })
    throw error
  }
}
```

The function keeps its return value and its thrown errors. In Node.js, call
`await flowmark.shutdown()` before the process exits. The Next.js client drains
delivery with `after()`.

Create a project and a write key in the
[dashboard](https://app.flowmark.dev), run the code, and open the recorded
execution. Browser setup, typed workflows, and the rest of the API are in the
[documentation](https://docs.flowmark.dev).

## Capabilities

**Follow one execution.** Open a run and see the sequence of milestones and
operations, where time was spent, the latest progress, and the errors your code
recorded along the way.

**Read the reported result.** `done()` and `fail()` can carry a business
outcome and a small JSON summary: imported and skipped counts, a shipment id,
how far a sync got. The same facts are available on the run and across recent
history.

**See what changed.** Workflow views show volume, completion, duration, and
reported outcomes over time. Compare a recent window, then open the runs behind
the change.

**Find a specific case.** Search run history by an enabled business reference,
such as an order or customer id, and continue from that run into the timeline.

**Connect related work.** Continue one run across later requests with the same
workflow name and id. Pass `correlationId` or `parentRunId` when separate runs
belong together.

## How it works

Your application keeps running the work. Flowmark records the markers you add
around it.

```text
Your application
  -> @flowmarkdev/node
  -> https://api.flowmark.dev
  -> a project in the dashboard
```

A workflow is a stable name, such as `checkout.order`. A run is one execution
of that name. Steps are milestones. Operations are timed pieces of work and may
overlap. Progress is an absolute snapshot. An outcome is the business result
your code chooses to report, alongside technical completion or failure.

The same markers work from a Node.js process, a Next.js server, or the browser.
Browser clients use a public browser key, or a same-origin proxy that keeps the
server write key private. See
[browser integration](https://docs.flowmark.dev/docs/browser).

Self-hosting uses these applications, the committed migrations, and PostgreSQL
you control.

## Documentation

- [flowmark.dev](https://flowmark.dev) — product
- [app.flowmark.dev](https://app.flowmark.dev) — dashboard
- [docs.flowmark.dev](https://docs.flowmark.dev) — guides and SDK reference
- [api.flowmark.dev](https://api.flowmark.dev) — API
- [`@flowmarkdev/node`](https://www.npmjs.com/package/@flowmarkdev/node) — npm
- [`packages/sdk/README.md`](./packages/sdk/README.md) — package details

## Repository

| Path             | Role                                        |
| ---------------- | ------------------------------------------- |
| `packages/sdk`   | Public SDK, `@flowmarkdev/node`             |
| `packages/core`  | Shared event contracts, `@flowmarkdev/core` |
| `packages/api`   | Use cases and ports                         |
| `packages/db`    | Schema, migrations, and persistence         |
| `apps/server`    | HTTP and tRPC shell                         |
| `apps/dashboard` | Current web interface, evolving into Studio |
| `apps/web`       | Landing page                                |
| `apps/docs`      | Customer documentation                      |

Sessions and local accounts live in `packages/auth`. `apps/dev-harness` and
`apps/internal-docs` are local-only and bind to loopback. The
[architecture guide](./docs/architecture.md) describes how the pieces connect.

## Local development

Node.js 20.19 or newer, pnpm 10.18.1, and Docker Compose.

```sh
pnpm install
pnpm dev:setup
pnpm infra up
pnpm db:setup
pnpm dev
```

`pnpm db:setup` runs once against this checkout's Compose database. Do not point
it at a hosted database. The dashboard is at <http://localhost:3001>.

Ports, checks, Drizzle Studio, and database safety are in the
[development guide](./docs/development.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).
Feature branches start from `staging` and open pull requests into `staging`.
Releases follow [application releases](./docs/releases.md). Maintained hosted
infrastructure follows the
[Pulumi writer policy](./docs/infrastructure.md#pulumi-is-the-infrastructure-writer).

- [Development](./docs/development.md)
- [Architecture](./docs/architecture.md)
- [Documentation index](./docs/README.md)
- [Decisions](./docs/decisions/)

## License

[MIT](./LICENSE)
