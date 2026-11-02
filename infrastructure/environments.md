# Reference deployment environment contract

Checked against application source, the four live Vercel projects, Neon endpoint
metadata and GitHub Actions configuration on 2 November 2026. This catalog lists
names and ownership, not secret values or operator resource IDs.

## Active environments

Production uses `main`; Staging uses the controlled `staging` rollout on the
same projects, with branch-scoped Vercel Preview variables. Automatic feature
Preview deployments are intentionally paused on all four projects. Their
existing general Preview configuration and isolated database remain parked for
future use. Do not enable automatic previews as a side effect of import.

The live inventory contains **25 managed application env records**: 15 nonprod
and 10 production/shared records, including four Production-only sensitive records.
All required records have the expected scopes; no forbidden hosted override
was found. Secret presence/type is verified, but unreadable secret payloads
are not exposed by the audit.

## API: `apps/server`

Production requires separate Production-only records for:

- `DATABASE_URL`: sensitive, pooled URL of the Production Neon branch.
- `BETTER_AUTH_SECRET`: sensitive, active Production auth-signing secret.
- `FLOWMARK_AUTH_PROXY_SECRET`: sensitive, matching only the Production dashboard.
- `BETTER_AUTH_URL` and `FLOWMARK_DASHBOARD_ORIGIN`: dashboard origins, both
  `https://app.flowmark.dev`.

Staging requires six Preview records scoped specifically to `staging`:

- `DATABASE_URL` and `BETTER_AUTH_SECRET`: separate sensitive Staging values.
- `BETTER_AUTH_URL` and `FLOWMARK_DASHBOARD_ORIGIN`: both
  `https://app.staging.flowmark.dev`.
- `FLOWMARK_DATABASE_BRANCH=staging`.
- `FLOWMARK_AUTH_PROXY_SECRET`: sensitive, matching only the Staging dashboard.

The parked general Preview scope has the same five names, with its own
sensitive database/auth values and `FLOWMARK_DATABASE_BRANCH=preview`.
On a feature branch, the API derives the dashboard origin from the git branch
when platform metadata is available. The stored fallback origins are
non-production. No database/auth record combines Production and Preview targets.

These values are read at server/request boundaries. Database identity is not
proved by the branch label alone; URL hosts must map to the expected Neon
endpoints. Nonprod URL/endpoint and read-only SQL identity checks passed during
adoption. No connection string belongs in a browser bundle.

## Dashboard: `apps/dashboard`

- Production requires `FLOWMARK_API_URL=https://api.flowmark.dev` and its own
  sensitive `FLOWMARK_AUTH_PROXY_SECRET`, matching only the Production API.
- Staging requires its own Preview record scoped to `staging`, with
  `FLOWMARK_API_URL=https://api.staging.flowmark.dev`.
- General Preview deliberately has no static API-origin record: the dashboard
  derives the sibling API URL from `VERCEL_GIT_COMMIT_REF`. A missing static
  record there is not a configuration gap.
- `FLOWMARK_VERCEL_PROTECTION_BYPASS` is sensitive and limited to Preview. It
  carries an existing API automation bypass when the proxy needs to reach a
  protected preview. It is not a browser variable or a new auth provider.
- `NEXT_PUBLIC_FLOWMARK_DOCS_URL` is a shared public Production/Preview link to
  the published introduction page. The code also has a public-link fallback.

The dashboard receives no database URL or Better Auth signing secret.

## Staging auth proxy binding

The durable-auth implementation supports `FLOWMARK_AUTH_PROXY_SECRET` on API
and dashboard. It is a separate server-only secret, at least 32 characters, with
matching values only within one environment. Keep Production, Staging and the
parked Preview isolated. It grants rate-limit source attribution, never user
sign-in or database access; the dashboard still receives no Better Auth signing
secret or database URL.

The two Staging-only records are managed by the nonprod Pulumi stack, using
`importStagingAuthProxyBindings`, encrypted `stagingAuthProxySecret` and the
explicit `stagingAuthProxySecretVersion` activation counter. They remain
Preview-target records scoped to `gitBranch=staging`. Production and parked
Preview have no new proxy binding. Changing the value requires a reviewed
version update on both records and an ordered Staging redeploy. See
[Pulumi ownership](./README.md#staging-auth-proxy-secret) and
[auth rollout](../docs/auth-perimeter.md#rollout).

The application remains compatible without the optional secret, using
account/service limits and the immediate network source. Successful signed
requests prove the shared-secret hop; end-user source isolation also depends on
the real platform-provided IP header and must be distinguished from account and
project authorization evidence.

### Production proxy configuration

Production's API and dashboard each have a sensitive
`FLOWMARK_AUTH_PROXY_SECRET` record, scoped only to Production with no branch
override. The Production Pulumi stack manages them behind
`manageProductionAuthProxyBindings=true`, using shared encrypted
`productionAuthProxySecret` and explicit `productionAuthProxySecretVersion`.
The first approved apply created exactly these two records, with 27 existing
resources unchanged. Production uses a separate generated value from Staging;
existing auth/database secrets were preserved. Keep the opt-in enabled after
provisioning; future changes require a reviewed version update and matching
ordered deployment. See the [operator contract](./README.md#production-auth-proxy-bindings).

## Landing and docs

The landing app uses public links `NEXT_PUBLIC_FLOWMARK_APP_URL` and
`NEXT_PUBLIC_FLOWMARK_DOCS_URL`, shared across Production/general Preview.
Staging overrides only the application URL so it points to the Staging app.
These links are not credentials; changing them requires a new build because
Next.js inlines `NEXT_PUBLIC_*` values.

The docs app requires no hosted application env records. Its optional
`FLOWMARK_DOCS_DIST_DIR` supports local build separation and is not a required
hosted credential. The dev harness and internal docs remain local-only.

## Platform and build-provided context

Vercel supplies `NODE_ENV`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`,
`VERCEL_GIT_COMMIT_SHA` and its other system metadata. All four projects have
system environment exposure enabled; project adoption preserves that explicitly.
Do not create custom records that override `NODE_ENV` or `VERCEL_ENV`.

The controlled rollout injects `FLOWMARK_CONTROLLED_DEPLOY=true` for builds and
`FLOWMARK_DEPLOYMENT_SHA` for runtime revision checks. These are per-deployment
inputs, not persistent project env records. `turbo.json` forwards the app's
database, auth, `FLOWMARK_*` and `NEXT_PUBLIC_*` build inputs.

`FLOWMARK_DEMO_MODE`, `DATABASE_MIGRATION_URL` and `FLOWMARK_API_KEY` must not
exist in hosted app settings. Demo mode belongs to the loopback fixture; write
keys belong to observed customer applications; direct migration credentials
belong to the guarded migration runner.

## GitHub Actions and migrations

Repository variables:

- `FLOWMARK_RELEASE_PIPELINE_ENABLED=true`.
- `VERCEL_ORG_ID` and the four `VERCEL_{API,DASHBOARD,DOCS,WEB}_PROJECT_ID`
  references. Their values match live Vercel identities.
- `MIGRATION_PREVIEW_HOST`, `MIGRATION_STAGING_HOST`,
  `MIGRATION_PRODUCTION_HOST`: distinct, direct/unpooled Neon hosts matching
  the respective live branch endpoints.

`deploy-staging` and `deploy-production` each own their environment-scoped
`VERCEL_TOKEN` and `MIGRATION_DATABASE_URL` secrets. Each `database-preview`,
`database-staging` and `database-production` environment owns its scoped
`MIGRATION_DATABASE_URL`. Required names and resolved repository references
were verified without reading secret values. The post-merge Staging rollout
passed on the merged nonprod infrastructure revision.

The migration wrapper supplies `MIGRATION_TARGET`, `MIGRATION_SHA`,
`FLOWMARK_MIGRATION_APPROVED`, `NEON_BRANCH` and a temporary direct
`DATABASE_MIGRATION_URL` to its guarded subprocess. These are not app settings.
`TEST_DATABASE_URL` is the CI job's disposable Postgres connection.

npm publication uses existing OIDC trusted publishing; an `NPM_TOKEN` secret
is not required. Publication remains a separately approved operation.

## Pulumi credentials and ownership

Pulumi Cloud login and provider authentication are separate. Local provider
processes use `NEON_API_KEY` and `VERCEL_API_TOKEN`, or their encrypted provider
config equivalents. Do not put these on the deployed applications. No automatic
Pulumi CI update workflow is configured, so a GitHub `PULUMI_ACCESS_TOKEN` secret
is not a missing requirement.

Nonprod owns its branches, computes, database containers, roles and 15 bindings.
Production owns the Neon project and production resources, four shared Vercel
project containers, seven custom domains and ten Production/shared app env records.
It never declares inline env blocks that compete with individual binding resources.
CI secrets stay GitHub-owned;
schema/history stays Drizzle-owned; build commands/regions stay in `vercel.json`.

Active Production database/auth values are encrypted in Pulumi configuration.
Sensitive imports preserve them through the write-only protocol. Changes require
reviewed value-version updates; merely editing secret config does not rotate a
live value. Inactive replacement auth values are guarded against actual import.
Use an explicitly approved secure path for any future transfer/rotation, with
the matching app redeploy. Never invent placeholders or send values in chat.

## Verification limits

All required names/scopes and 14 readable public values were checked. Public
web/docs/dashboard pages and API health returned HTTP 200. Production/Staging
API and dashboard signed-out session endpoints returned 200/null, checking the
auth/proxy configuration without accounts or writes. Health/session-null checks
do not prove signed-in authorization, ingestion or business-flow correctness.
Secret validity in GitHub cannot be inferred from presence alone; the completed
Staging rollout supplies current evidence for that runner's credentials.
