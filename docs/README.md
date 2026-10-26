# Internal documentation

This directory is the canonical source for **contributors and maintainers**.
The separate `apps/internal-docs` app renders these Markdown files locally at
`http://127.0.0.1:3005`; edit the Markdown here rather than maintaining a
second copy in the app.

> **Local-only and unauthenticated:** the internal docs app has no access
> control. It binds to loopback for development and must not be deployed or
> exposed on a public network.

## Guides

- [Infrastructure](./infrastructure): what is provisioned, starting with the
  Neon reference database, and how local demo stays separate from it.
- [Development setup](./development): workspace commands, local demo, database,
  and checks.
- [Architecture](./architecture): service boundaries, persistence,
  local auth, and current system constraints.
- [Product vision](../PRODUCT-VISION.md): long-term product direction. It
  lives at the repository root and supersedes the retired north star and
  business plan.
- [Product definition](./product): current model, delivered capabilities, and
  boundaries. Keep it consistent with the product vision.
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
