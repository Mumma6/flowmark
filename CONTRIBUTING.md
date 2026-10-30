# Contributing

Thanks for helping improve Flowmark. This repository is the application,
SDK, and dashboard source. You can explore and change it without access to
maintainer-only planning or infrastructure notes.

## Get started locally

Requirements and the full local pipeline are in the
[development guide](./docs/development.md). In short:

```sh
pnpm install
pnpm dev:setup
# Set DATABASE_URL in apps/server/.env.local to a loopback Postgres database.
pnpm db:setup
pnpm dev
```

Open the dashboard at `http://127.0.0.1:3001`. The
[architecture overview](./docs/architecture.md) explains how the SDK, API,
persistence, and dashboard fit together.

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

## Databases and self-hosting

Flowmark stores workflow telemetry in PostgreSQL through an ordinary
`DATABASE_URL`. Local development should use a dedicated loopback database.
`pnpm db:setup` and `pnpm db:seed` apply migrations and fixture data only in
safe local demo mode; **never** run seed or demo setup against hosted
production, staging, preview, or other shared databases.

Neon and Vercel are the maintainers' **reference** deployment for
[flowmark.dev](https://flowmark.dev); they are not required to hack on the
code or to run your own instance. Any PostgreSQL compatible with the committed
migrations is enough for self-hosting. Flowmark is open-source software you
run yourself — not a separate enterprise SSO product or second hosted tier.

See [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md) for
infrastructure choices that apply to the reference deployment.

## Security

Report suspected vulnerabilities through [SECURITY.md](./SECURITY.md). Do not
paste secrets, tokens, or connection strings into issues or pull requests.

## License

Contributions are licensed under the repository [MIT License](./LICENSE).
