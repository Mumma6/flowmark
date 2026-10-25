# Flowmark

**Workflow observability for application code.**

Start with [the north star](./NORTH-STAR.md) for the product's purpose,
principles and decision filter. Use the [independent review prompt](./REVIEW-PROMPT.md)
to challenge its value, architecture and developer experience.

Flowmark lets developers instrument important business workflows and
investigate what happened in a specific run: which milestones it reached, what
context was known, whether an error was recovered or terminal, and what result
the application recorded. It adds semantic workflow events around existing
application code; it is not an execution engine or a replacement for logs,
tracing, or error tracking.

```ts
const flow = flowmark.workflow("checkout")
flow.step("payment-created")
flow.step("order-created")
flow.done({ result: { orderId: "ord_123", total: 42.5 } })
```

Each workflow call records a separate run. A run's name, steps, outcome, and
optional properties are instrumentation supplied by your application. Keep
sensitive values out of telemetry. Delivery is best-effort, so a telemetry
failure does not roll back business work.

`flow.runId` exposes the SDK run identifier. Per-run `correlationId` and
`parentRunId` let application code explicitly link browser, server, and job
runs; the SDK does not propagate IDs automatically. Shared correlation groups
application-declared runs but does not prove causation. Run links are project-
scoped, and browser-provided metadata remains untrusted.

## Current capabilities

- A TypeScript SDK for server/Node.js, Next.js, and browser instrumentation.
- An ingestion API that validates and persists events in PostgreSQL.
- A dashboard that shows project-scoped runs, summaries, and timelines.
- A local-only operations harness with invoice imports, inventory syncs and order fulfillment, plus isolated SDK diagnostics.

The SDK's `defineConfig()` is a typed identity helper: it returns its argument
unchanged. You explicitly import that config and pass it to `createFlowmark()`;
Flowmark does not search for or auto-load a `flowmark.config.ts` file.

Server integrations use a private write key. Direct browser delivery uses a
public browser key that is intentionally visible, can only write browser
telemetry, and is restricted by allowed origins and a quota. Never put a server
write key in browser code or a `NEXT_PUBLIC_*` variable. Browser telemetry is
untrusted and must not be treated as proof of a business outcome.

There is no hosted Flowmark API. Local dashboard sign-in is Better Auth email
and password; seed creates `local@dev` for the shared operations project, and
registration creates a separate project with its first write key. Applications
still authenticate with a project write key. The local demo credentials are
not production secrets. There is no alerting, hosted key rotation, durable
offline delivery, or operated production service.

## Repository

| Path                 | Purpose                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `apps/server`        | Next.js server app, HTTP routes, and tRPC orchestration          |
| `packages/api`       | Framework-independent API use cases, ports, and adapters         |
| `apps/dashboard`     | Workflow runs, summaries, and timelines                          |
| `apps/dev-harness`   | Loopback-only local harness for SDK and workflow development     |
| `apps/docs`          | Customer-facing SDK and self-hosting documentation               |
| `apps/internal-docs` | Unauthenticated, loopback-only contributor documentation         |
| `apps/web`           | Product landing page                                             |
| `packages/core`      | Workflow domain and event contract                               |
| `packages/db`        | Drizzle schema, migrations, and database boundary                |
| `packages/sdk`       | `@flowmark/node` server, Next.js, and browser SDK                |
| `packages/ui`        | Shared UI primitives                                             |
| `docs/`              | Canonical internal architecture, development, and product guides |

## Development

Requirements: Node.js 20.19+ (24 LTS recommended) and pnpm 10.

```sh
pnpm install
pnpm dev:setup
# Set DATABASE_URL in apps/server/.env.local to a running development database.
pnpm db:setup
pnpm dev
pnpm test
pnpm typecheck
```

`pnpm dev` starts the six apps and watches the SDK/core build tasks through
Turborepo's terminal UI; `pnpm dev:stream` is available without the
interactive UI. Startup prepares missing local-demo environment files without
overwriting existing configuration. It does not start PostgreSQL or apply migrations. For
a working local data pipeline, configure PostgreSQL and demo mode as described
in the [development guide](./docs/development.md#local-demo-with-postgresql),
then open the [local dev harness](http://127.0.0.1:3004) and
[dashboard](http://127.0.0.1:3001). The harness is for local development only
and must never be deployed or exposed publicly.

The SDK quickstart, integration examples, security/privacy guidance, and
self-hosting guide are in the [customer documentation](http://localhost:3002/docs/introduction)
when the docs app is running. Contributor setup, architecture, product
decisions, and roadmap are in [internal docs](http://127.0.0.1:3005) when that
local-only app is running; it has no authentication and must not be exposed
publicly. See the [internal documentation index](./docs/README.md) and
[development commands and app URLs](./docs/development.md).

## MVP 0.1 and contributor handoff

The local product core works, including email/password dashboard auth. Hosted
deployment, key-management UI, and npm release are the remaining MVP 0.1 work.

- [MVP infrastructure plan](./MVP-INFRA.md): hosting, PostgreSQL, Better Auth,
  environment validation, migration/seed separation, and SDK distribution.
  Confirmed choices are in [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md).
- [Phase status](./NEXT-PHASE-PLAN.md): delivered increments and outstanding
  product validation.
- [Contributor/agent handoff](./HANDOFF.md): current limitations, commands,
  and previous verification.
- [Agent guidelines](./AGENTS.md): persistent project rules. Portable architecture
  and UI skills live in [`.agents/skills/`](./.agents/skills/).
