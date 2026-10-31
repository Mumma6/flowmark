<p align="center">
  <img src="docs/assets/flowmark-mark.svg" width="72" height="72" alt="Flowmark" />
</p>

<h1 align="center">flowmark.</h1>

<p align="center">
  <strong>Know what your workflows actually accomplish.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowmarkdev/node"><img alt="npm" src="https://img.shields.io/npm/v/@flowmarkdev/node?color=b9f597&label=npm&labelColor=0d1311" /></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-b9f597?labelColor=0d1311" /></a>
  <a href="https://flowmark.dev"><img alt="flowmark.dev" src="https://img.shields.io/badge/flowmark.dev-0d1311" /></a>
</p>

A completed run is only part of the story. Flowmark records what a process in
your application actually did: milestones, timed operations, progress, errors,
and the business result your code reported. Many executions then become a
picture of volume, duration, failures, and reported outcomes.

Flowmark observes work your application already owns. It does not execute,
schedule, or retry that work. A completed run is not proof that every record
succeeded. Missing terminal telemetry does not prove that a run is still active
or that it failed.

## Install

Requires Node.js 20.19 or newer.

```sh
npm i @flowmarkdev/node
```

```ts
// Next.js Route Handler or Server Action
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

The write key stays on the server. Never put it in `NEXT_PUBLIC_*` or a browser
bundle. `FLOWMARK_API_URL` is the API origin, not `/v1/events`.

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

Keep the function's return value and thrown errors. Telemetry failures do not
change business behavior. In Node, call `await flowmark.shutdown()` before the
process exits. The Next.js adapter drains with `after()`.

Customer documentation: [docs.flowmark.dev](https://docs.flowmark.dev). Package
details: [`packages/sdk/README.md`](./packages/sdk/README.md).

## What you can record

`@flowmarkdev/node` 0.2.0, `@flowmarkdev/node/next`, and
`@flowmarkdev/node/browser` share the same run markers:

- A named workflow run, continued later with the same name and `id`
- Steps, overlapping operations, absolute progress, and non-terminal errors
- A bounded JSON result and an optional business outcome on `done()` or `fail()`
- Non-final `report()` snapshots that do not become the final result
- Explicit `correlationId` and `parentRunId` links you pass yourself
- Optional typed `defineWorkflow()` handles, explicit attempt metadata, and
  durable expectations

Newer markers need an API that accepts them. Delivery is best-effort. Browser
workflows use a public browser key and are stored with a `browser.` name
prefix. The SDK does not invent retries, schedules, or verified business
correctness.

## What you can investigate

Sign in on the dashboard, create a project, and create a write key. Password
reset is not available. The dashboard then shows project-scoped evidence:

- Execution volume, success rate, duration, and trends
- Slow operations, failure codes, and run timelines
- Reported results, business outcomes, and last-reported progress
- Peer comparison and explicitly related runs
- Enabled business-reference search on run history

Overview panels use bounded snapshots, including the latest 100 runs for recent
failures. Run history itself is server-paginated and is not limited to that
snapshot.

|           |                                                                        |
| --------- | ---------------------------------------------------------------------- |
| Landing   | [flowmark.dev](https://flowmark.dev)                                   |
| Dashboard | [app.flowmark.dev](https://app.flowmark.dev)                           |
| Docs      | [docs.flowmark.dev](https://docs.flowmark.dev)                         |
| API       | [api.flowmark.dev](https://api.flowmark.dev)                           |
| npm       | [`@flowmarkdev/node`](https://www.npmjs.com/package/@flowmarkdev/node) |

## Repository

| Path                 | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `packages/sdk`       | `@flowmarkdev/node`                          |
| `packages/core`      | Shared event contracts (`@flowmarkdev/core`) |
| `packages/api`       | Use cases and ports                          |
| `packages/db`        | Schema, migrations, persistence              |
| `packages/ui`        | Shared UI                                    |
| `apps/server`        | HTTP and tRPC shell                          |
| `apps/dashboard`     | Signed-in product UI                         |
| `apps/web`           | Landing page                                 |
| `apps/docs`          | Customer documentation                       |
| `apps/dev-harness`   | Local-only fixture app                       |
| `apps/internal-docs` | Local-only contributor docs                  |

`apps/dev-harness` and `apps/internal-docs` bind to loopback. Do not deploy
them.

## Local development

Node.js 20.19+ (24 LTS recommended) and pnpm 10.18.1.

```sh
pnpm install
pnpm dev:setup
# Set DATABASE_URL in apps/server/.env.local to a loopback Postgres database.
pnpm db:setup
pnpm dev
```

Open the dashboard at `http://127.0.0.1:3001`. The
[development guide](./docs/development.md) covers the local pipeline, checks,
and database safety. Self-hosting needs the same apps, committed migrations,
and any PostgreSQL you control.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [SECURITY.md](./SECURITY.md).
Feature branches start from `staging` and open pull requests into `staging`.
Release policy is in [application releases](./docs/releases.md).

- [Development](./docs/development.md)
- [Architecture](./docs/architecture.md)
- [Documentation index](./docs/README.md)
- [Decisions](./docs/decisions/)

License: [MIT](./LICENSE).
