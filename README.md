<p align="center">
  <img src="docs/assets/flowmark-mark.svg" width="72" height="72" alt="Flowmark" />
</p>

<h1 align="center">flowmark.</h1>

<p align="center">
  <strong>Application memory for AI-native software teams.</strong><br />
  Give your coding agent the production cases its next change needs to handle.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flowmarkdev/node"><img alt="npm" src="https://img.shields.io/npm/v/@flowmarkdev/node?color=b9f597&label=npm&labelColor=0d1311" /></a>
  <a href="./LICENSE"><img alt="FSL-1.1-ALv2 platform license" src="https://img.shields.io/badge/License-FSL--1.1--ALv2-b9f597?labelColor=0d1311" /></a>
  <a href="https://flowmark.dev"><img alt="flowmark.dev" src="https://img.shields.io/badge/flowmark.dev-0d1311" /></a>
</p>

Your agent knows the code. Flowmark remembers what happened in production.

Every code change starts with a decision about which behavior to preserve,
what to fix, and what to test. Production history can inform that decision.
It can show which paths actually ran, which attempts belonged together, and
which outcomes arrived after the original execution ended.

We’re building Flowmark so an agent can start with a ticket, diff, file or
symbol and retrieve the production cases that matter for its next change.
The team sets intent and approves the change. The agent uses the evidence to
implement and test it. Once the application runs again, its observations
become evidence for future agents.

Authorized agents can already use MCP to find and inspect recorded executions.
Automatic retrieval from a code change is in development.

## Start here

- [Connect a coding agent to Flowmark via MCP](https://docs.flowmark.dev/docs/mcp)

- [Product definition and target agent tools](docs/product.md)
- [Using runtime memory in the software factory](docs/agent-workflow.md)
- [Runtime evidence and coverage](docs/runtime-memory.md)
- [Implemented capabilities and outstanding work](docs/implementation-status.md)
- [SDK integration reference for agents and adapters](packages/sdk/README.md)

## Documentation

- [flowmark.dev](https://flowmark.dev) — product
- [app.flowmark.dev](https://app.flowmark.dev) — dashboard
- [docs.flowmark.dev](https://docs.flowmark.dev) — guides and SDK reference
- [api.flowmark.dev](https://api.flowmark.dev) — API
- [`@flowmarkdev/node`](https://www.npmjs.com/package/@flowmarkdev/node) — npm
- [`packages/sdk/README.md`](./packages/sdk/README.md) — package details

## Repository

| Path                     | Role                                        |
| ------------------------ | ------------------------------------------- |
| `packages/sdk`           | Public SDK, `@flowmarkdev/node`             |
| `packages/core`          | Shared event contracts, `@flowmarkdev/core` |
| `packages/api`           | Use cases and ports                         |
| `packages/db`            | Schema, migrations, and persistence         |
| `packages/auth`          | Sessions, local accounts, and agent access  |
| `packages/mcp`           | Private read-only MCP adapter               |
| `packages/engine`        | Effect adapter for the Rust Engine          |
| `crates/flowmark-engine` | Deterministic Rust computation              |
| `packages/evidence-view` | Portable supplied-data evidence views       |
| `packages/email`         | Private transactional delivery              |
| `packages/ui`            | Shared presentation and controls            |
| `packages/demo`          | Synthetic local showcase tooling            |
| `packages/config`        | Shared tool configuration                   |
| `apps/server`            | HTTP, tRPC, and MCP route shell             |
| `apps/dashboard`         | Studio                                      |
| `apps/web`               | Landing page                                |
| `apps/docs`              | Customer documentation                      |

`apps/dev-harness` and
`apps/internal-docs` are local-only and bind to loopback. The
[architecture guide](./docs/architecture.md) describes how the pieces connect.

## Local development

TypeScript + Effect is the primary application platform. PostgreSQL owns
data-local persistence and analytics. Rust is a permanent architectural option
for cohesive computation, analysis, algorithms and data processing; the
[Flowmark Engine](./docs/engine.md) is its first production integration.
Future Rust modules and crates can build on the same explicit ownership and
contract boundaries. See [architecture](./docs/architecture.md#typescript-postgresql-and-rust).

Node.js 24.x (see `.node-version`), pnpm 10.18.1, and Docker Compose.

```sh
pnpm install
pnpm dev:setup
pnpm infra doctor
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
- [Flowmark Engine (Rust/WASM)](./docs/engine.md)
- [Documentation index](./docs/README.md)
- [Decisions](./docs/decisions/)

## License

The platform uses [FSL-1.1-ALv2](./LICENSE): source-available, with restrictions
on competing commercial uses. Each version also becomes available under Apache
2.0 two years after it is made available. FSL is not OSI-approved open source.

The public SDK ([core](./packages/core/LICENSE) and [node](./packages/sdk/LICENSE)),
documentation and examples use Apache-2.0. SDK consumers can use the SDK in
personal, commercial, enterprise and open-source applications without adopting
FSL. Using the hosted service does not require licensing your application under FSL.

Previously distributed MIT versions retain their MIT rights. Code licenses do
not grant general rights to the Flowmark name or branding. See
[licensing scope and exceptions](./docs/licensing.md).
