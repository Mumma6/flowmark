# Reference infrastructure

Flowmark's public product is four applications and a PostgreSQL database. You
can run the same applications yourself. Neon and Vercel are the maintainers'
reference deployment, not a requirement for every install.

This page records the public shape of that deployment. It does not include
credentials, connection strings, or operator runbooks. The separate
[Pulumi TypeScript project](../infrastructure/README.md) manages the existing
Neon project, three persistent branches and their computes/database containers/
owners, four shared Vercel projects, seven custom-domain assignments and all
25 app env records. Deletion protection covers all 49 managed cloud resources,
including the two separately provisioned Production auth proxy bindings.
Standard refresh-preview and preview report 26 unchanged state resources in
nonprod and 29 in production. The policy below distinguishes current adoption
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

Provider choices and the dated consequences are in
[ADR 0006](./decisions/0006-mvp-0.1-infrastructure.md). Local variables and
safety rules are in the [development guide](./development.md).
