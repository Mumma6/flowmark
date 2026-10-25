# Internal documentation

This directory is the canonical source for **contributors and maintainers**.
The separate `apps/internal-docs` app renders these Markdown files locally at
`http://127.0.0.1:3005`; edit the Markdown here rather than maintaining a
second copy in the app.

> **Local-only and unauthenticated:** the internal docs app has no access
> control. It binds to loopback for development and must not be deployed or
> exposed on a public network.

## Guides

- [Development setup](./development): workspace commands, local demo, database,
  and checks.
- [Architecture](./architecture): service boundaries, persistence,
  local auth, and current system constraints.
- [Product definition](./product): positioning, principles, delivered
  capabilities, and product boundaries.
- [SDK evolution](./sdk-evolution): Stage 1 implementation and explicitly
  proposed future SDK contracts.
- [Architecture decisions](./decisions/0001-turborepo): accepted decisions and
  their consequences.

## Customer documentation

SDK installation and usage, integrations, insights, API behavior,
security/privacy, local development, and troubleshooting belong in the
separate customer-facing docs app at
[http://localhost:3002](http://localhost:3002) when running locally. Do
not add contributor-only workspace setup or internal architectural material
to those customer guides.

The repository root `README.md` is the shared entry point and links to both
documentation audiences.
