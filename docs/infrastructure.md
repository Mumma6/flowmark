# Reference infrastructure

Flowmark's public product is four applications and a PostgreSQL database. You
can run the same applications yourself. Neon and Vercel are the maintainers'
reference deployment, not a requirement for every install.

This page records the public shape of that deployment. It does not include
credentials, connection strings, or operator runbooks. The separate
[Pulumi TypeScript project](../infrastructure/README.md) manages the existing
Neon project, three persistent branches and their computes/database containers/
owners, four shared Vercel projects, seven custom-domain assignments, a Resend
sending domain with four verification DNS records, a separate Production sending key, and all 33 app env records.
Deletion protection covers all 63 managed cloud resources.
Standard refresh-preview and preview report 31 unchanged state resources in
nonprod and 42 in production. The policy below distinguishes current adoption
coverage from the required writer for future changes.

Local repository development uses Docker Compose only; applications run natively.
See [local infrastructure](./development.md#local-postgresql-with-compose).
Compose does not manage or replace the hosted environments below.

## Pulumi is the infrastructure writer

All infrastructure and persistent hosted configuration for Flowmark's maintained
environments must be changed through the existing [Pulumi project](../infrastructure/README.md).
This includes new and existing resources, temporary cloud branches, environment
bindings and secrets, domains/DNS, access/protection settings, and persistent
CI/provider configuration. New providers follow the same rule. This policy does
not prescribe infrastructure tooling for SDK customers or independent self-hosts.

Provider connectors, CLIs and dashboards are useful for inventory, documentation,
logs and verification. They are not an alternative writer: do not create or
modify infrastructure there and import it afterward. Do not use `pulumi do`,
`vercel env add`, direct provider API writes or `neon deploy` as shortcuts around
the resource program.

### One source for environment configuration

Pulumi is the authoring source for hosted application and CI environment
configuration. Vercel env records, GitHub environment/repository variables and
secret bindings are delivery targets, not independent places to maintain values.
Declare a logical value once per environment, then derive or reuse it across its
consumers. For example, API and dashboard consume the same proxy secret within
Production, while Staging has a separate secret. Prefer resource outputs/shared
stack inputs over repeated literal origins, IDs or connection strings.

Use encrypted Pulumi stack config for secret inputs; an already approved central
secret store may supply references through Pulumi. Do not create a second secret
catalog or copy values into provider dashboards, workflow YAML or app env files.
Do not duplicate a value into unrelated config files/stacks for convenience;
share the appropriate secret-preserving reference instead. Persist a generated
value encrypted before provisioning its first binding, and retain it for later
runs. A provider's unreadable sensitive value is not a recoverable source.

`infrastructure/environments.md` documents names, scopes and owners; it is not a
second store of secret or authoritative runtime values. `.env.example` and local
app env files serve local/loopback development only. Vercel system variables and
per-deployment revision metadata are supplied by their platform/pipeline, not
manually maintained env records. A new required hosted variable must ship with
its Pulumi binding and catalog update, or remain explicitly pending before rollout.

Current app env records are Pulumi-managed. CI bindings and duplicated per-binding
inputs inherited from initial imports still need consolidation/adoption. Keep
those gaps explicit, preserve active values/scopes during that reviewed work,
and do not silently call the configuration fully centralized already.

### Review and apply

Before a live change:

1. Inspect the actual resource and its current property owner. Extend the Pulumi
   program on a task branch; import existing resources without recreating them.
   New resources must be declared before they are provisioned.
2. Put secrets in encrypted Pulumi config or an approved secret store before
   first use. Keep environment scopes explicit, preserve existing credentials,
   and never put secret values in command arguments, logs or Git.
3. Review the source and preview for the exact stack/environment/revision.
   Apply the approved plan through Pulumi, then verify live behavior and full
   preview/refresh results. A targeted apply still needs full-stack verification.
   Reuse approval for that same operation; a PR merge does not by itself approve
   unrelated infrastructure or new hosted secrets.

Some existing properties are not yet adopted: GitHub settings/secrets,
registrar/DNS-zone configuration and certain ignored provider properties retain
their recorded owners today. This is a coverage gap, not permission for manual
changes. Adopt the affected property into a reviewed Pulumi resource before
changing it. If the pinned provider lacks support, prepare the provider/ownership
change for review first; do not introduce a second writer or provision manually.
No adoption or provider upgrade is performed merely by documenting this policy.

Application artifacts still deploy through the controlled Actions pipeline;
Pulumi does not replace it with deployment resources. Promoting an artifact or
pointing an existing managed alias at its deployment is a rollout operation;
creating/changing domain or DNS configuration is infrastructure. Drizzle owns database
schema/history. Application build contracts remain in versioned `vercel.json`
and scripts; do not duplicate their ownership in hosted project settings. Runtime
data operations, backup/restore, retention execution and publication retain their
separate approval procedures. Operator sign-in/consent supplies credentials; it
does not authorize infrastructure changes. See [database rollout](./migrations.md),
[releases](./releases.md), and the [environment contract](../infrastructure/environments.md).

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
recovery uses the transactional email package when server mail settings are
configured. Recovery requires a one-time mailbox link; normal signup/sign-in does
not require a previously verified address. Sign-up creates an account. The
first project and write key are created in onboarding or Settings.

## Environments

| Environment | Database                                        | How code gets there                                                                |
| ----------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| Local demo  | Loopback PostgreSQL in `apps/server/.env.local` | `pnpm dev`                                                                         |
| Preview     | Neon branch `preview`                           | Automatic feature deployments paused in the Pulumi program; bindings retained      |
| Staging     | Neon branch `staging`                           | **Migrate and deploy** after a push to `staging`, when the pipeline flag is `true` |
| Production  | Neon branch `production`                        | **Migrate and deploy** after a push to `main`, when the pipeline flag is `true`    |

Repository development and CI use Node 24 (`.node-version`). The Pulumi program
declares Node `22.x` for the four Vercel projects (`infrastructure/vercel-production.ts`).
Published `@flowmarkdev/core` and `@flowmarkdev/node` require Node.js 20.19 or
newer. This page does not change those versions. A declaration in Git is not
proof of the runtime currently executing on Vercel.

Preview, Staging, and Production do not share one database. Local demo setup
stays on loopback. `pnpm db:setup` and `pnpm db:seed` are local commands. Do not
point them, Drizzle Studio, or `pnpm demo:*` at a hosted branch. Do not seed Neon.

`GET /api/health` is a liveness check. It does not prove that the database or
authentication is available.

## What is deployed with the apps

Vercel builds the four public apps from this repository. The Pulumi program sets
`previewDeploymentsDisabled: true` on all four projects, so automatic
feature-branch deployments are paused. Each app `vercel.json` disables Git
deployment for `staging` and `main` only. Other branch names stay allowed in
that file; the file does not turn the project-level pause back on. Staging is
the non-production rollout. The Neon `preview` branch remains available to an
approved standalone migration. This repository cannot show whether the live
Vercel project still matches the Pulumi input.

A push to `staging` or `main` starts
[Migrate and deploy](./migrations.md#controlled-merge-pipeline). The rollout
migrates the matching Neon branch and then deploys the apps only when
`FLOWMARK_RELEASE_PIPELINE_ENABLED` is `true`. When it is not, verification
still runs and the rollout exits before checkout, migration, or deployment.
The previous deployment keeps serving, because Git deployment for those two
branches is off. Whether the live GitHub variable is set is not in this
repository. See [database rollout](./migrations.md) and
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

Provider choices and the dated consequences are in
[ADR 0006](./decisions/0006-mvp-0.1-infrastructure.md). Local variables and
safety rules are in the [development guide](./development.md).
