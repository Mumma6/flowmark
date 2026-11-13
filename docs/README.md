# Documentation

Flowmark's Product 1.0 direction is one process-intelligence platform with a
programmable foundation, a contextual Studio and access through agents/custom
interfaces. The [README](../README.md) and [product introduction](../apps/docs/content/docs/introduction.mdx)
distinguish implemented capabilities from that direction. Maintainer vision,
specification, roadmap and messaging remain in ignored `private/`; public guides
must not depend on those files.

Contributor guides that ship with the public repository:

- [Contributing](../CONTRIBUTING.md): onboarding, branches, local-only apps,
  and self-hosting expectations.
- [Security policy](../SECURITY.md): private vulnerability reporting.
- [Development setup](./development): workspace commands, local demo, database,
  and checks.
- [Developer commands](./development-commands): command inventory and cleanup decisions.
- [Database integration tests](./development#database-integration-tests): local
  test setup and the separate disposable-Postgres PR job.
- [Health and failure diagnostics](./development#health-and-failure-diagnostics):
  liveness limits, safe log fields, and API storage versus dashboard proxy errors.
- [Reference infrastructure](./infrastructure): public hostnames, Preview,
  Staging, Production, the Pulumi writer policy and current adoption boundaries.
- [Database rollout](./migrations): migration order, environment guards, and
  the activated merge pipeline.
- [Application releases](./releases): feature PRs into staging, release PRs into
  main, verification, versioning, and recovery. Synchronization is needed for
  independent main changes such as hotfixes, not after ordinary releases.
- [Architecture](./architecture): service boundaries, persistence, local auth,
  and current system constraints.
- [Rust and the Evidence Engine](./evidence-engine): Rust's permanent architectural
  role, current calculation ownership, workspace/WASM tooling and verification.
- [Effect and module organization](./code-organization): pure models, service ownership,
  error/lifetime boundaries and the staged Studio folder target.
- [Implementation status](./implementation-status): public mirror of shipped
  Connect Your Agent and related Product 1.0 items through Agent TASK-005.4.
- [Authentication boundaries](./auth-perimeter): provider login, registration,
  proxy protections, and remaining durable-limit work.
- [Account security](./account-security): active browser sessions, password-confirmed
  session sign-out and account controls before onboarding.
- [Historical facts](./historical-facts): compact run projections and backfill
  limits.
- [Data lifecycle](./data-lifecycle): complete telemetry erasure, project deletion,
  key invalidation, resumable cleanup and backup limitations.
- [Design system](./design-system): dashboard and landing presentation rules.
- [Architecture decisions](./decisions/0001-turborepo): accepted decisions and
  their consequences. See [ADR 0007](./decisions/0007-connect-agent-mcp-dependencies.md)
  for the accepted Connect Your Agent MCP/OAuth dependency tranche. See
  [ADR 0008](./decisions/0008-connect-agent-protocol-contract.md) for the frozen
  protocol, grant, client and tool contract.
- [Public run read contract](./decisions/0010-public-run-read-contract.md):
  accepted first consumer, wire contract and implementation handoff,
  implemented in source; see the public run read guide for deployment/publication limits.

SDK contracts used by the implementation live under `docs/sdk/`:

- [Technical period comparison](./sdk/public-period-read): exact windows, coverage and the same server-side consumer.
- [Public run read](./sdk/public-run-read): project read keys, metadata pages and the server-side TypeScript consumer.
- [Results and reports](./sdk/result-contract)
- [Run continuation](./sdk/run-continuation)
- [Business outcome reads](./sdk/business-insights)
- [Expectations](./sdk/expectations)

Customer-facing SDK and product docs live in `apps/docs` and at
[docs.flowmark.dev](https://docs.flowmark.dev).

The repository root `README.md` is the shared entry point. Package details are
in `packages/sdk/README.md`, `packages/core/README.md`, `packages/api/README.md`,
`packages/auth/README.md`, `packages/db/README.md`, and `packages/mcp/README.md`.
