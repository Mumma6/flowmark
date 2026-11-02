# Flowmark infrastructure

This is the Pulumi TypeScript project for Flowmark's existing Vercel and Neon
reference deployment. Resources are adopted by import, starting with
non-production. Do not recreate them with a starter template.

Persistent reference-infrastructure adoption completed on 2 November 2026.
`nonprod` has 26 state resources: its two Neon branches, computes, databases and
owner roles, 15 Vercel env bindings, and three Pulumi metadata resources.
`production` has 29: the Neon project/production branch/compute/database/owner,
four shared Vercel projects, seven custom-domain assignments, ten Production/shared
env bindings, and three metadata resources. All **49 managed cloud resources**
have deletion protection. Standard refresh-preview and preview are clean in both
stacks. See the public
[infrastructure overview](../docs/infrastructure.md) for the deployment shape.

The [environment contract](./environments.md) records all required app,
platform/build, CI/migration and provider variables, their scopes and owners.
Automatic feature previews are intentionally paused; only the controlled
Staging flow is active for non-production deployments.

## Required writer for infrastructure changes

Follow the [Pulumi writer policy](../docs/infrastructure.md#pulumi-is-the-infrastructure-writer).
All Flowmark infrastructure and persistent hosted configuration changes use this
project, including future providers, CI settings, hosted secrets and ephemeral
cloud resources. Connectors/CLIs/dashboards inspect and verify; they do not create
or update resources before later import. `pulumi do` is not a substitute for the
resource program. Review source and exact-stack preview before the approved apply.

The inventory below describes current adoption, not blanket exemptions. Existing
external or ignored properties must be adopted into a reviewed Pulumi owner before
mutation. Missing provider support is work to design/review first. Keep app
artifact deployment, Drizzle migrations and approved data/publication operations
on their documented paths; do not add competing infrastructure writers.

## Environment configuration belongs here

Follow the [single-source env contract](../docs/infrastructure.md#one-source-for-environment-configuration).
The Pulumi program owns hosted app/CI definitions and distributes bindings to
Vercel/GitHub. Use one logical stack input or resource output per environment,
shared by its consumers; do not maintain parallel values in provider UIs or app
`.env` files. Secret inputs default to encrypted Pulumi config, with references
to an approved central store when needed. The environment catalog records the
contract, not another copy of secret/runtime values.

Remaining consolidation includes GitHub environments/variables/secret bindings,
shared logical inputs replacing import-era per-binding value keys, and adoption
of external DNS/ignored provider properties when changed. Review provider support
and preserve existing live values before those migrations. This documentation
change establishes the required path; it does not provision/adopt those resources
or introduce another config/secret system.

## Install and validate

Requirements: Node.js 22 or newer, pnpm 10.18.1, and Pulumi CLI 3.273.0.
This directory has its own small pnpm workspace and lockfile, outside the
application workspace and Turbo graph. Generate the local SDK from the exact
provider versions in `Pulumi.yaml`, then install its separate lockfile:

```sh
cd infrastructure
pulumi install --no-dependencies
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
```

Root `pnpm check` validates the applications. It does not typecheck this project.
From the repository root, lint and format infrastructure changes with:

```sh
pnpm exec eslint infrastructure/*.ts infrastructure/test
pnpm exec prettier --check infrastructure
```

The Pulumi program is a declarative SDK entry point. Resource declarations and
their dependency graph belong to Pulumi's runtime; they do not run through the
application's Effect runtime or import application packages.

## State and stacks

Use an existing Pulumi Cloud account. `Pulumi.yaml` pins that backend so that
state is stored remotely rather than only on a workstation. The Free edition
includes one user and IaC state management, unlimited projects/stacks and update
history, with no credit card required ([pricing](https://www.pulumi.com/pricing/),
checked 1 November 2026). Paid features and plan changes require approval.

Log in locally; never paste an access token into a chat or a command argument:

```sh
pulumi login
pulumi whoami --verbose
export PULUMI_ORG=your-pulumi-organization
```

A project is the resource program. A stack is an isolated instance with its own
state and configuration. This project uses:

- `nonprod`: Preview/Staging Neon branches and their computes, database
  containers and owners; 15 Preview-target env bindings with Staging overrides.
- `production`: the Neon project and production branch/compute/database/owner,
  shared Vercel projects, seven custom domains and ten production/shared envs.
  The four Vercel projects serve all environments; never declare the same
  project resource in both stacks.

If the stacks do not already exist in your chosen organization, create their
empty state records once (this does not provision provider resources):

```sh
pulumi stack init "$PULUMI_ORG/nonprod" --secrets-provider default
pulumi stack init "$PULUMI_ORG/production" --secrets-provider default
```

Always name the stack explicitly:

```sh
pulumi preview --stack "$PULUMI_ORG/nonprod" --diff
pulumi preview --stack "$PULUMI_ORG/production" --diff
```

Learn more about [projects](https://www.pulumi.com/docs/iac/concepts/projects/),
[stacks](https://www.pulumi.com/docs/iac/concepts/stacks/) and
[preview](https://www.pulumi.com/docs/iac/cli/commands/pulumi_preview/).

## Credentials and configuration

Pulumi Cloud authentication is separate from Vercel and Neon authentication.
Connected tools and CLI sessions can inventory resources, but that does not
automatically supply credentials to a Pulumi provider. Verify provider-specific
authentication before attempting imports. Do not extract connector credentials.

Use secret stack configuration or an approved secret store for provider tokens,
database URLs, passwords, and auth secrets. Enter values through Pulumi's prompt,
not shell arguments. For the Neon provider:

```sh
pulumi config set --stack "$PULUMI_ORG/nonprod" --secret neon:apiKey
```

Read secrets with `config.requireSecret()` and preserve secret outputs. Never
export connection strings or tokens as plaintext stack outputs, run with
`--show-secrets`, or commit state exports. `Pulumi.<stack>.yaml`, local state,
and saved JSON plans are ignored. Keep recoverable secrets in an approved secret
store; do not rely on an ignored workstation config as their only copy. See
[configuration](https://www.pulumi.com/docs/iac/concepts/config/) and
[secrets](https://www.pulumi.com/docs/iac/concepts/secrets/).

Do not pull hosted environment values into the local app `.env.local` files.
The local demo stays on loopback.

## Adoption and ownership

Inventory the live resource first, verify the installed provider's import ID
and schema, and match the current settings before adopting it. Review one
resource class at a time. An import records an existing resource in Pulumi
state; it must not recreate it. Preview before every approved import/update;
stop on unexpected create, replace, delete, or secret-value changes. Apply with
`pulumi up` only after approval of that exact stack and plan. Then refresh with
`pulumi refresh --preview-only` and re-run preview to check for drift.

The program registers a resource transform before any resource declarations
that forces `protect: true`. This blocks ordinary deletions and replacements
after adoption. Do not remove protection to make a preview pass. It does not
replace provider-side protection or prevent deletion outside Pulumi.
**`pulumi destroy` is not a production command.** No disposable cloud resources
are needed for this foundation.

Each property has one writer:

- Pulumi owns persistent Neon project/branch identity, project defaults,
  compute sizing/suspension, database containers and owner-role resources.
  Branch ancestry, provider-side protection and project security/maintenance/
  quota policies retain their existing owners. Role passwords and project
  connection outputs are computed secrets, encrypted in state.
- Pulumi owns all 25 app env bindings, four Vercel project containers and seven
  custom-domain assignments. Sensitive values use the write-only protocol below.
  Registrar/DNS-zone services and automatic `*.vercel.app` aliases retain their
  existing platform ownership; this program does not create a second DNS writer.
- Vercel app `vercel.json` files keep framework, region, install/build and ignore
  commands. Match them during import instead of introducing competing values.
- Application deployments stay on the existing Git/controlled Actions path.
  Never add `vercel.Deployment` resources or replace the rollout workflow.
- Drizzle alone owns database schema/history. Pulumi does not migrate or seed.
- `packages/db/neon.ts` records a CLI TTL policy; it is not a second provisioner
  for this repository. New temporary cloud branches need reviewed Pulumi lifecycle
  support before creation. The pinned provider's missing schema-only/TTL support
  is not permission to use the CLI instead. Persistent Preview/Staging branches
  must retain their existing ancestry and absence of expiry.
- npm publication stays separate and human-approved.
- `apps/dev-harness` and `apps/internal-docs` remain local-only.

## Provider checks before adoption

The installed Vercel provider is `@pulumiverse/vercel` **5.21.1**. The registry's
overview currently refers to `@pulumi/vercel`, but that package is not published;
the installed package and its declarations are authoritative. It supports
explicit team scope and import of individual environment-variable bindings.
Do not combine individual binding resources with inline project `environment`
properties, which would introduce competing writers.

The registry's [Neon provider](https://www.pulumi.com/registry/packages/neon/)
is marked deprecated, with its upstream Terraform provider archived (checked
1 November 2026). The documented installation is a locally generated package
via Pulumi's Terraform bridge. Do not assume an old `@pulumi/neon` dependency
is maintained or that branch creation supports schema-only initialization.
The maintainer approved the pinned legacy provider for controlled import on
1 November 2026. `Pulumi.yaml` pins `kislerdm/neon` to `0.18.0` and the Terraform
bridge to `1.5.1`. Generated files in `sdks/` are ignored; regenerate them using
the install commands above. The only allowed dependency build script is this
SDK's reviewed TypeScript compilation and metadata copy. The local workspace
pins its compiler to TypeScript 5.9.2. Review all future provider/compiler/CLI
upgrades and re-run previews before applying them.

The installed branch schema has `projectId`, `name`, `parentId`, `parentLsn`,
`parentTimestamp`, and `protected`; only `projectId` is required. It has no
schema-only initialization, TTL, or endpoint settings. Branch declarations
only specify name/project and a mandatory import ID; ancestry and provider-side
protection remain ignored. Separate `Endpoint` resources own existing computes.
No creation path, database schema or expiry changes are included. Deletion protection is
separate from Neon's paid provider-side branch-protection feature.

Set the inventory-verified IDs locally before the first preview (replace the
example values; never use the production branch ID):

```sh
pulumi config set --stack "$PULUMI_ORG/nonprod" neonProjectId your-neon-project-id
pulumi config set --stack "$PULUMI_ORG/nonprod" previewBranchId br-your-preview-id
pulumi config set --stack "$PULUMI_ORG/nonprod" stagingBranchId br-your-staging-id
```

Branch import IDs are `project-id/branch-id`. The approved first import adopted
exactly two protected branches and created only Pulumi stack/provider metadata.
No Neon resource was created, updated, replaced, or deleted. Both
`pulumi refresh --preview-only --expect-no-changes` and
`pulumi preview --expect-no-changes` passed afterward with four unchanged state
resources. Live branch metadata retained the same IDs, schema-only origin,
ancestry, provider-side protection and absence of expiry. No database rows were
read or modified. Future normal previews must remain clean; further resource
classes and production require their own reviewed import approval.

For the initial preview, the existing Neon CLI OAuth session was refreshed
with a read-only branch listing and supplied to the provider through
`NEON_API_KEY` for that one process. No token was saved to stack config or
printed. A normal future invocation needs a current `NEON_API_KEY` environment
or the secret `neon:apiKey` setting above. CLI OAuth tokens expire; do not store
them as permanent provider configuration or extract connector credentials.

## Vercel non-production binding adoption

`vercel-nonprod.ts` declares the original 13 Preview-target bindings:
five API bindings for general Preview, five API overrides for `staging`, the
dashboard's Preview protection-bypass binding and Staging API URL, and the
web app's Staging application URL. Every import names the team, project and
environment-variable ID. Staging stays a branch-specific Preview scope;
Production/Development and shared multi-target records are excluded.

The module returns no resources until `importVercelBindings=true` is explicitly
set. Do not enable it until config is complete and a reviewed preview is ready;
do not disable it after adoption, which would propose deleting the protected
bindings. Existing Neon resources remain declared in either case.

Configuration consists of `vercelTeamId`, `vercelApiProjectId`,
`vercelDashboardProjectId`, `vercelWebProjectId`, and inventory-verified binding
IDs named `<app>-<preview|staging>-<kebab-case-key>-id`. Readable values use the
same prefix with `-value` instead of `-id`. For example, the Staging dashboard
API origin uses `dashboard-staging-flowmark-api-url-value`. Do not infer IDs
from names or copy a Production value into a Preview record.

Active sensitive values must be supplied through secret config keys
`previewDatabaseUrl`, `stagingDatabaseUrl`, `previewBetterAuthSecret`,
`stagingBetterAuthSecret` and `previewProtectionBypass`. Enter them through the
`pulumi config set --secret` prompt or a secure local transfer. Never use a
placeholder. If originals are unavailable, any replacement must be approved
and set in Vercel separately before adoption. Moving an existing credential
into a new secret store requires approval for that destination.

Vercel does not return sensitive values after they are set. The documented
`write-only:` import prefix and `valueWo` input preserve those live values
without reading or rewriting them. `valueWoVersion` stays absent during import,
matching the imported state; a later secret update needs an explicitly reviewed
version bump in the program. Merely changing secret config does **not** rotate
the live value. Readable values use `value` and are managed normally after
import. All value outputs are marked secret, and every binding has deletion
protection. The final live preview confirms exactly 13 binding imports, one
Pulumi provider create and four unchanged resources, with no value updates,
replacements or deletions.

Run preview with both provider sessions available. The Vercel provider accepts
`VERCEL_API_TOKEN` or secret `vercel:apiToken`; a Vercel CLI login alone does
not automatically export that environment variable. A live import requires
separate approval of the final plan. The first Vercel import is complete:
13 existing bindings were adopted and only one Pulumi provider metadata record
was created. No Vercel value, scope, visibility or timestamp changed during
import. Post-import refresh-preview and preview passed with 18 unchanged state
resources. Both database URLs were matched to the correct Neon branch endpoints
and distinct from Production, with read-only SQL identity checks. Schema-only
branch origins and absence of expiry were preserved. No application rows were
read and no SQL writes were performed. The completed additional adoption is
recorded below.

The infrastructure tests use Pulumi mocks to verify the explicit opt-in gate
and all 13 import IDs, with Preview-only targets, exact branch overrides,
project/team scoping, and write-only secret imports without a version bump.
They create no live resources.

### Staging auth proxy secret

Two additional Preview-target bindings scoped to `staging` share
`FLOWMARK_AUTH_PROXY_SECRET` between API and dashboard. They are independently
gated by `importStagingAuthProxyBindings=true` and use the verified IDs
`api-staging-flowmark-auth-proxy-secret-id` and
`dashboard-staging-flowmark-auth-proxy-secret-id`. The value comes from encrypted
`stagingAuthProxySecret`; neither the IDs nor stack configuration belong in Git.

For an existing sensitive record, first import with
`stagingAuthProxySecretVersion` absent. Then preview and explicitly approve a
positive integer version increment to activate the encrypted value on both
records. A missing version preserves the existing live value during import;
editing the encrypted input alone does not activate it. Do not add a version to
unrelated sensitive bindings. Keep the gate enabled after adoption, retain
deletion protection, and redeploy API/dashboard through the ordered Staging
pipeline after a value change. Production and parked Preview have no proxy
binding in this change.

On 2 November 2026, adoption imported exactly those two records with 24 resources
unchanged. A second reviewed update activated only their value versions; no
other resource changed. Standard preview and refresh-preview then reported
26 unchanged nonprod state resources. The active secret is marked secret in
Pulumi Cloud's update configuration as well as the local encrypted config.

### Production auth proxy bindings

`vercel-production-auth-proxy.ts` declares two new bindings only when
`manageProductionAuthProxyBindings=true` on the Production stack. It is called
through the existing Production project provider; the nonprod program is
unchanged. Both records have `targets=["production"]`, no branch override,
sensitive visibility and deletion protection. They share encrypted
`productionAuthProxySecret` (at least 32 characters) and a required positive
integer `productionAuthProxySecretVersion`.

Unlike adoption of existing records, initial provisioning has no import ID.
Version 1 writes the new value during creation; later value changes require a
reviewed version increment on both bindings. Keep the opt-in enabled after
creation. Do not reuse the Staging secret, add Preview/Development targets, or
rotate the existing Better Auth/database secrets as part of this operation.

The reference deployment has provisioned these two records through an approved
Pulumi update: exactly two creates and 27 unchanged existing resources. The
ordinary encrypted stack config retains the opt-in, value and version. For a
new installation, review the live Production preview before approval; its
initial plan must contain exactly two env-record creates and all existing
resources unchanged. A separate ignored config file can hold the
prepared encrypted value and opt-in for preview without enabling the active
operator config. Stop on unrelated updates, replacements or deletes. A saved-plan
apply can target only the two reviewed env URNs; still verify the full stack
before and after the update. After an approved apply, release through the existing
`staging` to `main` pipeline so
migration/history checks precede API and dashboard deployment. Pulumi does not
perform migrations or application deployment.

## Production project containers: first resource class

`vercel-production.ts` manages the four existing shared Vercel projects adopted
into the production stack. Its import gate stays disabled until
`importVercelProjects=true`; required settings are `vercelTeamId` and all four
`vercel{Api,Dashboard,Web,Docs}ProjectId` values. IDs must be distinct. Imports use
`team-id/project-id`; they cannot create substitute projects when an ID is absent.

The program owns project identity, app root, Node 22.x, system env exposure,
affected-project deployment selection and the intentionally paused automatic
feature previews. It explicitly matches the verified disabled Passport state;
this avoids a provider default that otherwise requires a missing paid-feature
connector during preview. Existing Vercel Authentication remains separate and
unchanged.

Git connections/options, build/install/ignore commands, framework/regions,
advanced security/billing settings and domain assignment retain their current
owners and are explicitly ignored during this import. Inline `environments`
are never declared; individual binding resources remain the only env writer.
Do not add `vercel.Deployment` resources or change the controlled Staging rollout.

The approved import completed on 1 November 2026: four protected projects and
only two Pulumi metadata creates, with no settings updates, replacements or
deletions. Before/after reads matched project settings, all 21 env records,
domain assignments and Production deployment IDs. Public URLs remained available;
automatic feature previews stayed paused. No Production credentials were
transferred or rotated. Keep the import gate enabled after adoption.

The import initially omitted `passport.enabled=false` from stored inputs while
retaining the disabled value in outputs. The bridge drops optional zero values
during import; the provider then defaults a configured Passport block with no
`enabled` input to true during refresh's planning comparison. This produced
four reported updates despite unchanged live settings. A temporary accurate-diff
diagnostic identified `passport.enabled` on all four projects.

An approved no-op update of the existing program persisted its explicit
`passport: { enabled: false }` inputs. The reviewed saved plan allowed only six
unchanged resources and no provider create/update/delete operations. Standard
`pulumi refresh --preview-only --expect-no-changes` and
`pulumi preview --expect-no-changes` now both pass without diagnostic flags.
Before/after Vercel settings, env records, domains and Production deployment IDs
remain identical. No provider upgrade, ignored Passport field or global legacy
diff setting was needed. Keep the explicit false declaration and verify standard
refresh after future imports; a zero-value omission must not be mistaken for a
live setting change.

## Remaining persistent resources: adoption complete

`neon-additional.ts` adopts the existing project and Production branch, plus the
three existing computes, database containers and owner roles. Database containers
do not include SQL tables/history: Drizzle keeps that ownership. The project
ignores inline branch/primary-compute settings so they cannot compete with the
separate resources. Existing Postgres 18, six-hour history, 0.25–2 CU bounds and
the observed suspend setting are preserved. No branch or database was created.

`vercel-domains.ts` adopts seven custom-domain assignments. Staging domains keep
their `staging` branch, and `www.flowmark.dev` keeps its 308 apex redirect. The
four platform aliases remain platform-owned. No DNS records or protection
exceptions are changed by this import.

`vercel-production-bindings.ts` adopts six readable production/shared records
and two Production-only sensitive records. General Preview, Staging and Production
database/auth records remain separate. The sensitive records use write-only
imports without a version bump, preserving their active values.

Additional opt-ins are `importProductionNeon`, `importNeonBranchResources`,
`importVercelDomains`, `importProductionVercelBindings`,
`importProductionDatabaseBinding` and `importProductionAuthBinding`. Keep enabled
gates enabled after adoption. All IDs and active sensitive values come from
ignored stack config; no operator IDs or credentials belong in Git.
Per-branch config includes `{stage}EndpointId`, `{stage}DatabaseName` and
`{stage}DatabaseOwnerRole`; Production also requires `neonOrgId` and
`productionBranchId`.

Production sensitive config is `productionDatabaseUrl` and
`productionBetterAuthSecret`. An unavailable sensitive original must never be
replaced with a placeholder. Any replacement/activation needs explicit approval
and an app redeploy before adoption. `productionAuthSecretPending=true` allows
planning that step but blocks actual binding adoption until activation completes.
No `vercel.Deployment` resource is introduced; deployment ownership is unchanged.

The remaining imports added 26 protected cloud resources and one provider
metadata record. They made no existing-resource updates, replacements or
deletions. Post-import standard refresh/preview report 24 unchanged resources
in nonprod and 27 in production, without diagnostic flags.
