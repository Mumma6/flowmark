# Reference infrastructure

Flowmark's public product is four applications and a PostgreSQL database. You
can run the same applications yourself. Neon and Vercel are the maintainers'
reference deployment, not a requirement for every install.

This page records the public shape of that deployment. It does not include
credentials, connection strings, or operator runbooks. The separate
[Pulumi TypeScript project](../infrastructure/README.md) manages the existing
Preview/Staging Neon branches and 13 non-production Vercel environment bindings,
imported with deletion protection on 1 November 2026. Post-import previews report
18 unchanged state resources. The four shared Vercel project containers are also
adopted with deletion protection in the production stack; its ordinary preview
reports six unchanged state resources. See the Pulumi project notes for a
default-refresh diff limitation. Domains, the Production Neon branch and
production/shared env bindings await separate adoption.

## Hostnames

| Surface   | URL                         | App              |
| --------- | --------------------------- | ---------------- |
| Landing   | `https://flowmark.dev`      | `apps/web`       |
| Docs      | `https://docs.flowmark.dev` | `apps/docs`      |
| Dashboard | `https://app.flowmark.dev`  | `apps/dashboard` |
| API       | `https://api.flowmark.dev`  | `apps/server`    |

`www.flowmark.dev` redirects to the apex. `apps/dev-harness` and
`apps/internal-docs` are local-only and are not deployed.

People sign in to the dashboard with email and password. Applications send
telemetry with a project write key. Those are different credentials. Password
reset stays off until email delivery exists. Sign-up creates an account. The
first project and write key are created in onboarding or Settings.

## Environments

| Environment | Database                                        | How code gets there                                |
| ----------- | ----------------------------------------------- | -------------------------------------------------- |
| Local demo  | Loopback PostgreSQL in `apps/server/.env.local` | `pnpm dev`                                         |
| Preview     | Neon branch `preview`                           | Automatic feature previews paused; config retained |
| Staging     | Neon branch `staging`                           | Controlled rollout after a merge to `staging`      |
| Production  | Neon branch `production`                        | Controlled rollout after a release merge to `main` |

Preview, Staging, and Production do not share one database. Local demo setup
stays on loopback. Do not point `pnpm db:setup`, `pnpm db:seed`, or Drizzle
Studio at a hosted branch. Do not seed Neon.

`GET /api/health` is a liveness check. It does not prove that the database or
authentication is available.

## What is deployed with the apps

Vercel builds the four public apps from this repository. Automatic feature-branch
previews are currently paused on all four projects; Staging remains the active
non-production rollout. After the migrate-and-deploy pipeline is activated,
merges to `staging` and `main` migrate the matching Neon branch before
deploying the apps. See [database rollout](./migrations.md) and
[application releases](./releases.md). Preparing that workflow does not by
itself change live credentials or run a migration.

Migrations do not run inside a Vercel build or on an incoming request. The
guarded commands are `pnpm db:migrate:preview`, `pnpm db:migrate:staging`, and
`pnpm db:migrate:prod`. Each one refuses the wrong host. Hosted mutation still
requires approval for that environment.

The API is the only public app that opens the database. The dashboard proxies
auth, registration, and tRPC to the API. Landing and docs do not.

SDK packages publish separately to npm as `@flowmarkdev/node` and
`@flowmarkdev/core`. An application release does not publish those packages.

## Not in this repository

- A retention cleanup job. The reference window is 30 days; the job is not built.
- A backup restore drill.
- Alerting.
- Durable offline delivery.
- Production Neon branch, domain and production/shared env adoption into Pulumi
  state. Shared Vercel projects, non-production branches and non-production env
  bindings are adopted.

Provider choices and the dated consequences are in
[ADR 0006](./decisions/0006-mvp-0.1-infrastructure.md). Local variables and
safety rules are in the [development guide](./development.md).
