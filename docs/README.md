# Documentation

Flowmark is **Process Intelligence for People and Agents**. Product 1.0 is
implementation-complete; [implementation status](./implementation-status.md)
separates source capabilities, deliberate deferrals and operational follow-ups.
The [architecture](./architecture.md) owns package boundaries. Customer-facing
product and SDK guidance lives in `apps/docs`; maintainer plans stay private.

Contributor guides that ship with the public repository:

- [Contributing](../CONTRIBUTING.md): onboarding, branches, local-only apps,
  and deployment-support boundaries.
- [Security policy](../SECURITY.md): the private incident mailbox.
- [Development setup](./development.md): workspace commands, local demo, database,
  and checks.
- [Developer commands](./development-commands.md): command inventory and cleanup decisions.
- [Database integration tests](./development.md#database-integration-tests): local
  test setup and the separate disposable-Postgres PR job.
- [Health and failure diagnostics](./development.md#health-and-failure-diagnostics):
  liveness limits, safe log fields, and API storage versus dashboard proxy errors.
- [Reference infrastructure](./infrastructure.md): public hostnames, Preview,
  Staging, Production, the Pulumi writer policy and current adoption boundaries.
- [Database rollout](./migrations.md): migration order, environment guards, and
  the activated merge pipeline.
- [Application releases](./releases.md): feature PRs into staging, release PRs into
  main, verification, versioning, and recovery. Synchronization is needed for
  independent main changes such as hotfixes, not after ordinary releases.
- [Architecture](./architecture.md): service boundaries, persistence, local auth,
  and current system constraints.
- [Rust and the Flowmark Engine](./engine.md): Rust's permanent architectural
  role, current calculation ownership, workspace/WASM tooling and verification.
- [Effect and module organization](./code-organization.md): pure models, service ownership,
  error/lifetime boundaries and the staged Studio folder target.
- [Implementation status](./implementation-status.md): current source capabilities, deliberate deferrals and operational follow-ups.
- [Authentication boundaries](./auth-perimeter.md): provider login, registration,
  proxy protections and durable admission limits.
- [Account security](./account-security.md): active browser sessions, password-confirmed
  session sign-out and account controls before onboarding.
- [Historical facts](./historical-facts.md): compact run projections and backfill
  limits.
- [Data lifecycle](./data-lifecycle.md): complete telemetry erasure, project deletion,
  key invalidation, resumable cleanup and backup limitations.
- [Design system](./design-system.md): dashboard and landing presentation rules.
- [Architecture decisions](./decisions/0001-turborepo.md): accepted decisions and
  their consequences. See [ADR 0007](./decisions/0007-connect-agent-mcp-dependencies.md)
  for the accepted Connect Your Agent MCP/OAuth dependency tranche. See
  [ADR 0008](./decisions/0008-connect-agent-protocol-contract.md) for the frozen
  protocol, grant, client and tool contract.
- [Public run read contract](./decisions/0010-public-run-read-contract.md):
  accepted first consumer, wire contract and implementation handoff,
  implemented in source; see the public run read guide for deployment/publication limits.

SDK contracts used by the implementation live under `docs/sdk/`:

- [Technical period comparison](./sdk/public-period-read.md): exact windows, coverage and the same server-side consumer.
- [Public run read](./sdk/public-run-read.md): project read keys, metadata pages and the server-side TypeScript consumer.
- [Results and reports](./sdk/result-contract.md)
- [Run continuation](./sdk/run-continuation.md)
- [Business outcome reads](./sdk/business-insights.md)
- [Expectations](./sdk/expectations.md)

Customer-facing SDK and product docs live in `apps/docs` and at
[docs.flowmark.dev](https://docs.flowmark.dev).

The repository root `README.md` is the shared entry point. Package details are
in `packages/sdk/README.md`, `packages/core/README.md`, `packages/api/README.md`,
`packages/auth/README.md`, `packages/db/README.md`, and `packages/mcp/README.md`.

## Process intelligence and collaboration

- [Definition imports](./definition-imports.md): reviewed code-owned meaning.
- [Reference journeys](./reference-journeys.md): qualified lookup and ambiguity.
- [Linked comparisons](./linked-process-comparisons.md): populations and coverage.
- [Saved investigations](./saved-investigations.md): private live selections.
- [Shared investigations](./shared-investigations.md): sharing, captures and lifetime.
- [Project sharing](./project-sharing.md): fixed owner and project membership.
- [Business evidence](./business-evidence.md): owner publication and projections.
- [Data exports](./data-exports.md): bounded account and owner-project downloads.
- [Verified email changes](./account-email-changes.md): coordinated mailbox proof.
- [MCP adapter](../packages/mcp/README.md): tools, authority and bounded reads.
- [Portable views](../packages/evidence-view/README.md): supplied-data/host boundary.
- [Client evidence](./agent-clients/codex-cli.md): exact observed compatibility.

## Public user journeys

The customer documentation owns how-to guidance; the internal guides above own
contracts and operation. Start with [MCP setup](../apps/docs/content/docs/mcp.mdx),
[project access](../apps/docs/content/docs/project-access.mdx),
[investigations](../apps/docs/content/docs/investigations.mdx) and
[account/data controls](../apps/docs/content/docs/account-data.mdx).
Do not duplicate client-specific setup claims here; retain exact compatibility
evidence under `docs/agent-clients/`.
