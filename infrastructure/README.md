# Flowmark infrastructure

This is the Pulumi TypeScript project for Flowmark's existing Vercel and Neon
reference deployment. Resources are adopted by import, starting with
non-production. Do not recreate them with a starter template.

The `nonprod` stack manages the existing Neon `preview` and `staging` branches
and 13 non-production Vercel environment bindings, imported with approval on
1 November 2026. All adopted resources have Pulumi deletion protection;
post-import refresh-preview and preview report 18 unchanged state resources.
The `production` stack also manages the four shared Vercel project containers,
imported with approval and deletion protection on 1 November 2026. Its ordinary
post-import preview reports six unchanged state resources. The remaining
production resource classes are pending. See the public
[infrastructure overview](../docs/infrastructure.md) for the deployment shape.

The [environment contract](./environments.md) records all required app,
platform/build, CI/migration and provider variables, their scopes and owners.
Automatic feature previews are intentionally paused; only the controlled
Staging flow is active for non-production deployments.

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

- `nonprod`: the imported Preview and Staging Neon branches and 13 Vercel
  Preview-target environment bindings, including Staging branch overrides.
- `production`: the existing Neon project/production resources, shared Vercel
  projects, their domains and production bindings, once approved for adoption.
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

- Pulumi owns the imported Preview/Staging branch resources and their names.
  It ignores their ancestry and provider-side protection settings. All other
  branch resources/settings remain with their existing owner until explicitly
  adopted. Pulumi also owns the 13 imported nonprod Vercel bindings and readable
  values; sensitive values use the write-only versioned update protocol below.
- Vercel app `vercel.json` files keep framework, region, install/build and ignore
  commands. Match them during import instead of introducing competing values.
- Application deployments stay on the existing Git/controlled Actions path.
  Never add `vercel.Deployment` resources or replace the rollout workflow.
- Drizzle alone owns database schema/history. Pulumi does not migrate or seed.
- `packages/db/neon.ts` keeps its current TTL policy for new ephemeral branches.
  Existing persistent Preview/Staging branches must not gain that TTL. Decide
  property ownership before adopting branch settings; do not add a second writer.
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
schema-only initialization, TTL, or endpoint settings. `nonprod.ts` only
declares branch name and project, with a mandatory import ID. Ancestry and
provider-side protection remain explicitly ignored. No creation path, compute,
database schema, or expiry changes are included. Pulumi deletion protection is
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

`vercel-nonprod.ts` declares only the 13 existing Preview-target bindings:
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
read and no SQL writes were performed. Production adoption is a separate task.

The infrastructure tests use Pulumi mocks to verify the explicit opt-in gate
and all 13 import IDs, with Preview-only targets, exact branch overrides,
project/team scoping, and write-only secret imports without a version bump.
They create no live resources.

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

With the pinned CLI/provider versions, default refresh currently reports four
updates without field diffs, even when its serialized before/after inputs and
outputs are identical. A state-only refresh did not clear that report. A scoped
diagnostic with `PULUMI_ENABLE_LEGACY_REFRESH_DIFF=1` compares actual outputs and
reports six unchanged resources; ordinary `pulumi preview --expect-no-changes`
also passes after refresh. Record this default-refresh limitation separately;
do not treat future refresh differences as harmless without checking them.
No global diff setting or resource protection was changed.

Later classes adopt the Production Neon branch, domains and production/shared
env bindings. Each class still needs separate approval before `pulumi up`.
