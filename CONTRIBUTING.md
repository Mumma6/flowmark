# Contributing

Flowmark is an open-source process-intelligence platform for people and agents.
This repository contains its SDK, application services and current web interface,
which is evolving into Flowmark Studio. You can explore and change it without
access to maintainer-only planning or infrastructure notes.

## Get started locally

Requirements and the full local pipeline are in the
[development guide](./docs/development.md). In short:

```sh
pnpm install
pnpm dev:setup
pnpm infra status
pnpm infra doctor
pnpm infra up
pnpm db:setup
pnpm dev
```

Open the dashboard at `http://localhost:3001`. The
[architecture overview](./docs/architecture.md) explains how the SDK, API,
authentication, persistence, and dashboard fit together. Sign-in configuration
lives in the private `@flowmark/auth` package. Request boundaries are in
[Authentication request boundaries](./docs/auth-perimeter.md).

`dev:setup` copies public local templates without replacing existing configuration.
`infra up` starts checkout-scoped Docker Compose infrastructure; it does not
migrate or seed. `db:setup` explicitly applies local migrations and synthetic demo
fixtures once. Application startup never performs either operation. Preserve an
already-running container and record `container`/`startedByThisCall`; stop only a
service you started. Two active checkouts require separate ports. See the
[Compose instructions](./docs/development.md#local-postgresql-with-compose).

Use the local demo sign-in documented in the development guide, then select a
local project in Studio. Server ingestion and read keys have different roles;
create each under **Settings → API keys** when its example needs it. No hosted
account, maintainer ID, private planning file or AI client is required.

For a smaller first contribution, run the existing memory-only booking example
without Docker or a database:

```sh
pnpm exec turbo build --filter=@flowmarkdev/node...
pnpm --filter @flowmarkdev/node test booking-setup-demo
```

To extend a real read into a portable view, follow the
[query-to-view example](./examples/portable-evidence/README.md#read-a-real-authorized-selection-into-the-view).
Keep read credentials in the CLI environment; the viewer only receives supplied
metadata. These commands do not establish commercial AI-client compatibility or
certify every host platform. Optional AI setup is separate from contributing.

TypeScript + Effect remains the primary application platform; PostgreSQL and Rust
are established owners for appropriate data-local work and cohesive computation.
For computation, analysis or data-processing changes, evaluate the owner using the
[architecture guidance](./docs/architecture.md#typescript-postgresql-and-rust).
Rust contributions may extend the Flowmark Engine or introduce another justified
crate. Learning and functional craftsmanship are valid benefits; keep integration
cost and maintainability explicit. The [Rust/WASM guide](./docs/engine.md)
documents the shared toolchain, the workspace rust-analyzer settings and the
current engine's build and tests. Run `pnpm rust:setup` before relying on editor
diagnostics; it installs the pinned toolchain under ignored `.cache/rust/`.

Customer-facing SDK documentation is built from `apps/docs` and published at
[docs.flowmark.dev](https://docs.flowmark.dev). Change that site when the
public product docs need updates; this file is for repository contributors.

## Branches and pull requests

Create feature and infrastructure branches from `staging` and open pull
requests into `staging`. CI runs format, lint, typecheck, unit tests, and
disposable Postgres integration tests on each PR. Merge policy, release PRs
into `main`, and verification expectations are in
[application releases](./docs/releases.md).

Run `pnpm check` before you push. Do not merge or deploy from this document;
maintainers approve merges and releases explicitly.

## Local-only apps

`apps/dev-harness` and `apps/internal-docs` are loopback development tools.
They bind to `127.0.0.1`, are not part of the public product surface, and must
not be deployed. The harness generates fixture telemetry for local integration
checks; it is not a hosted demo.

## Local and hosted infrastructure

Maintained Flowmark infrastructure uses the
[Pulumi writer policy](./docs/infrastructure.md#pulumi-is-the-infrastructure-writer)
and existing `infrastructure/` project for all hosted resource/settings changes.
Provider tools inspect and verify; they are not an imperative provisioning path.
App deployments and Drizzle migrations keep their existing workflows. This
maintainer policy keeps hosted changes separate from local contributions.

Flowmark stores workflow telemetry in PostgreSQL through an ordinary
`DATABASE_URL`. Local development uses checkout-scoped Docker Compose on loopback.
`pnpm db:setup` and `pnpm db:seed` apply migrations and fixture data only in
safe local demo mode; **never** run seed or demo setup against hosted
production, staging, preview, or other shared databases.

Neon and Vercel host the maintained product at [flowmark.dev](https://flowmark.dev);
they are not required for local contributions. Open source provides code
transparency and extension examples; this contributor path does not promise a
supported self-host deployment topology.

See [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md) for
infrastructure choices that apply to the reference deployment.

## Security

Report suspected vulnerabilities through [SECURITY.md](./SECURITY.md). Do not
paste secrets, tokens, or connection strings into issues or pull requests.

## License

Contributions are licensed under the repository [MIT License](./LICENSE).
