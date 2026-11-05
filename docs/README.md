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
- [Authentication boundaries](./auth-perimeter): provider login, registration,
  proxy protections, and remaining durable-limit work.
- [Historical facts](./historical-facts): compact run projections and backfill
  limits.
- [Design system](./design-system): dashboard and landing presentation rules.
- [Architecture decisions](./decisions/0001-turborepo): accepted decisions and
  their consequences. See [ADR 0007](./decisions/0007-connect-agent-mcp-dependencies.md)
  for the accepted Connect Your Agent MCP/OAuth dependency tranche. See
  [ADR 0008](./decisions/0008-connect-agent-protocol-contract.md) for the frozen
  protocol, grant, client and tool contract.

SDK contracts used by the implementation live under `docs/sdk/`:

- [Results and reports](./sdk/result-contract)
- [Run continuation](./sdk/run-continuation)
- [Business outcome reads](./sdk/business-insights)
- [Expectations](./sdk/expectations)

Customer-facing SDK and product docs live in `apps/docs` and at
[docs.flowmark.dev](https://docs.flowmark.dev).

The repository root `README.md` is the shared entry point. Package details are
in `packages/sdk/README.md`, `packages/core/README.md`, `packages/api/README.md`,
`packages/auth/README.md`, and `packages/db/README.md`.
