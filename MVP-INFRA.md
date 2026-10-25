# Flowmark - MVP 0.1 Infrastructure

> Planning baseline: October 25, 2026. This document proposes the infrastructure
> needed to install, deploy, and use Flowmark outside its local POC environment.
> It does not claim that these capabilities are implemented.
>
> Scope: a small open-source tool and a maintainable reference deployment, not a
> public multi-tenant SaaS. Provider, auth-provider, and access-model choices are
> confirmed in [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md).
> Remaining sections still describe work that is not implemented.

## 1. What 0.1 should make possible

A developer can:

1. Deploy Flowmark with a normal PostgreSQL database.
2. Sign in, create a project, and obtain a server ingestion key.
3. Install the published SDK in an existing application.
4. Report a run and investigate it in the dashboard.
5. Reproduce local development without manually editing database rows.

Keep the workflow/run abstraction, current SDK surface, Drizzle, and Effect-first
API architecture. No workflow engine, billing, enterprise permissions, queue,
Redis, or OpenTelemetry migration is required.

The local harness remains internal, loopback-only, and never a deployment target.

## 2. Current state and gaps

| Area          | What exists                                                                | What is missing for 0.1                                                      |
| ------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Hosting       | Separate Next.js landing, docs, dashboard, and server apps                 | Deployment configuration, domains, environment isolation, operational checks |
| Database      | PostgreSQL, Drizzle schema, versioned migrations, `pnpm db:migrate`        | Documented hosted deploy process                                             |
| Setup         | `pnpm db:setup` migrates then seeds; seed refuses production/non-loopback and creates `local@dev` | Production onboarding without demo mode                                      |
| Auth          | Better Auth email/password; session-scoped dashboard reads; register creates owner, project, and first write key | Hosted auth URL/cookie setup, password reset, and key-management UI          |
| Credentials   | Hashed project read/write keys, browser keys, and dashboard create/revoke/rotate | Hosted rotation after a leak is still an operator process                    |
| Environment   | Effect Schema API settings, dashboard server-env checks, production demo refusal | Auth secrets and hosted URL validation in later increments                   |
| SDK release   | `@flowmark/node`, its `@flowmark/core` dependency, built ESM/types/exports | Tarball verification, external-install tests, registry setup, and release CI |
| Data browsing | Useful workflow and run views                                              | Server-side pagination beyond the latest-100-run snapshot                    |

Supabase Auth and the unused browser helper are gone. Choosing Supabase later
for PostgreSQL would not require choosing Supabase Auth.

## 3. Hosting: Vercel for the reference deployment

### Recommended layout

Use one repository and separate Vercel projects with these root directories:

| Application | Root directory   | Responsibility                                  |
| ----------- | ---------------- | ----------------------------------------------- |
| Landing     | `apps/web`       | Public product information                      |
| Docs        | `apps/docs`      | Public installation and SDK documentation       |
| Dashboard   | `apps/dashboard` | Signed-in UI and same-origin API forwarding     |
| API         | `apps/server`    | Ingestion, authorized reads, and auth endpoints |

### Domain: flowmark.dev

Use `flowmark.dev` as the public product domain, purchased through Vercel.
Confirm registration in the account before configuring DNS; this document does
not verify ownership or complete the purchase.

| Vercel project name  | Domain              | Application   |
| -------------------- | ------------------- | ------------- |
| `flowmark-web`       | `flowmark.dev`      | Landing       |
| `flowmark-docs`      | `docs.flowmark.dev` | Customer docs |
| `flowmark-dashboard` | `app.flowmark.dev`  | Dashboard     |
| `flowmark-api`       | `api.flowmark.dev`  | API           |

Optionally redirect `www.flowmark.dev` to `flowmark.dev`. Subdomains are DNS
records under the same domain, not separate domain purchases. No public domain
is assigned to the harness or internal docs.

### Small Vercel Hobby setup guide

Hobby is the starting plan for this personal, non-commercial project. A custom
domain does not require Pro; domain registration/renewal is paid separately.
Reassess plan terms, resource limits, and permitted use if the project becomes
commercial or needs team features. Domain ownership does not remove hosting
limits, and database hosting has its own costs.

1. **Prepare GitHub first.** Review ignored/staged files and secrets, confirm the
   license, and create the repository under the intended personal account. Do not
   connect an employer's GitHub/Vercel account or commit local env files.
2. **Select the personal Hobby scope** in the Vercel dashboard. Choose
   **Add New -> Project**, connect the personal GitHub account, and import the
   Flowmark repository.
3. **Start with `flowmark-web`.** Set Root Directory to `apps/web` and Framework
   Preset to Next.js. Keep access to workspace files outside that root enabled
   if Vercel presents that option. Use the repository's pinned pnpm and lockfile.
   Review the detected monorepo build settings: builds must include required
   workspace dependencies, not just execute `next build` without them. Keep the
   default Next.js output directory.
4. **Deploy and check the generated URL first.** Inspect build logs and test the
   page before attaching the domain. No database or auth secrets belong in the
   landing project. Replace localhost links with the intended public URLs before
   launch; hide links to product surfaces that are not available yet.
5. **Attach the domain.** In the landing project's **Settings -> Domains**, add
   `flowmark.dev`. If the domain is registered in the same Vercel scope, follow
   its suggested configuration. Otherwise follow the displayed DNS/verification
   instructions. Use the actual records Vercel shows, not hard-coded IPs from
   an old guide. Wait for valid configuration and HTTPS, then test the domain.
6. **Repeat the repository import for docs.** Name it `flowmark-docs`, use Root
   Directory `apps/docs`, and attach `docs.flowmark.dev` after the deployment
   works. The same GitHub repository backs both projects.
7. **Add API/dashboard only after the auth and DB increments.** Import the same
   repository separately with roots `apps/server` and `apps/dashboard`. Use the
   names/domains above. Do not expose the current local demo-mode setup or deploy
   an unauthenticated data API as a temporary shortcut.
8. **Set envs per project and environment.** Use each project's environment
   settings for Production/Preview separately, then redeploy when values change.
   The API gets runtime DB/auth credentials; the dashboard server points to
   `https://api.flowmark.dev`. Migrations run separately with migration
   credentials. Neither deployment receives local fixture keys or demo mode.
   Update Turborepo build env declarations/cache inputs for variables actually
   used during builds; the current dev-only pass-through list is not sufficient.
9. **Verify the complete hosted path.** Sign in through `app.flowmark.dev`,
   authorize the project, send SDK telemetry to `api.flowmark.dev`, and inspect
   the resulting run. Configure Better Auth's public browser-facing URL as
   `https://app.flowmark.dev` for the proposed same-origin auth proxy, with
   matching trusted origins and provider callback settings.

Use isolated preview data and configure preview auth deliberately; do not expose
unfinished sensitive deployments. Verify the selected Hobby deployment-protection
options rather than assuming every generated URL is private. Never add the local
fixture account as a way to access a hosted preview.

After setup, pushes to the configured production branch deploy production;
other supported branch/PR deployments create previews. Review automatic build
behavior and Hobby limits for the four projects before relying on it. Keep
unneeded backend projects unconnected until they are ready to deploy.

Do not deploy `apps/dev-harness` or `apps/internal-docs`. Do not merge apps merely
to save configuration: retain the existing small framework adapters over
`@flowmark/api`.

Use Node.js functions initially, not Edge. Configure monorepo dependency builds,
the pinned package manager, and shared package transpilation/build output.
Validate each app's output on Vercel rather than assuming local builds prove it.
Keep API compute and PostgreSQL in compatible nearby regions.

### Request and authentication boundaries

Recommended browser path:

```text
Browser -> dashboard /api/auth/* and /api/trpc/*
        -> server auth/session validation
        -> API project authorization -> PostgreSQL

Customer's server -> API ingestion with secret project key -> PostgreSQL
```

Host the canonical Better Auth instance in the server app. Forward auth and
dashboard read requests through the dashboard's same-origin boundary so browser
code does not need cross-site session cookies. The API validates the session and
project access; a client-supplied project ID or forwarded user ID is not authority.

Dashboard reads already use the signed-in session, not a shared demo read key.
Keep that split: do not make every signed-in user share an unrestricted
backend read key.

Forward only required headers/cookies to the configured trusted backend and
preserve required `Set-Cookie` headers. Configure canonical public auth URL,
trusted origins, callback URLs, and cookie settings explicitly. Verify the
complete proxy flow, CSRF/origin checks, sign-out, and production cookie behavior.
Do not invent a custom JWT exchange to avoid configuring Better Auth correctly.

Production and previews must never use development keys or the local demo mode.
Previews need an isolated database/branch and deliberate OAuth callback setup;
disable protected previews until that setup works rather than falling back to
production data.

Vercel is a reference deployment, not a requirement imposed on self-hosters.
Document normal Node.js hosting and PostgreSQL configuration too. Check current
provider limits, permitted usage, and costs before choosing a plan.

## 4. PostgreSQL: Neon recommended, Supabase supported

**Recommendation: Neon for the reference deployment.** We need managed PostgreSQL,
not a second authentication or application platform. Neon fits that narrow need.
This is not a reason to rewrite persistence around a provider-specific API.

**Supabase is also valid:** use its PostgreSQL connection with Drizzle and Better
Auth. Do not also add Supabase Auth or browser database access.

Retain `postgres` + Drizzle unless deployment testing reveals a concrete driver
problem. The current adapter already disables prepared statements; confirm pooler
compatibility, connection limits, transaction behavior, TLS, and function
lifecycle cleanup before shipping.

Use:

- `DATABASE_URL` for runtime connections, with provider-appropriate pooling.
- `DATABASE_MIGRATION_URL` for a direct/session-capable migration connection.
- Separate development, preview/test, and production databases.
- A deliberately bounded per-instance pool and correct lifecycle handling.
- A restricted runtime DB role and separate migration credentials where supported.

Do not open an unbounded pool per request. Do not assume a generic HTTP database
driver supports the transactions used by ingestion and provisioning. Neon/Vercel
connection guidance depends on the compute model; test the chosen combination.

Before production data matters, document backup availability, retention, restore
steps, and cost limits. Test a restore into an isolated database. Set an explicit
telemetry-retention policy and implement a bounded scheduled cleanup; the initial
retention period and deletion UI need a deliberate decision.

## 5. Better Auth: people sign in, SDKs use keys

Use Better Auth with its Drizzle adapter and the same PostgreSQL database.
Generate its auth schema using the supported CLI, review it, and commit ordinary
Drizzle migrations. Do not hand-invent user/session tables or auto-migrate during
requests.

### Confirmed initial access model

[ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md) chose email and
password. Sign-up creates a workspace, project, owner membership, and the first
write key. Password reset stays off until email delivery exists. Do not add
GitHub or Google OAuth in this increment.

- A signed-in owner sees only projects they belong to.
- Check project membership on every dashboard read and credential-management
  action.
- Keep workspaces as internal grouping; no organization/invitation UI or Better
  Auth organization plugin without a demonstrated need.

Authentication verifies the person; project authorization decides what that person
may access. Neither replaces authentication of an unattended SDK.

The unused Supabase auth scaffold is already removed. Keep real loading/error
states; do not restore fake sign-in or account controls.

### Local development account and harness project

The development seed should create a local Better Auth account, intended as
`local@dev`, with access to the **Fieldwork Operations** project. Use an address
accepted by the configured auth validator if that shorthand is rejected. Provision
the account through Better Auth's supported account/password APIs, not raw
password inserts. Provide a documented local-only sign-in method without requiring
GitHub OAuth or email delivery; this does not decide production sign-in policy.

The seed also provisions the project's server ingestion key for the harness.
The account has access to the Flowmark project; it does not authenticate or host
the harness application itself.

```text
Local harness -> SDK + project ingestion key -> Fieldwork Operations telemetry
Local account -> Better Auth session -> authorized dashboard project and runs
```

The local path already uses the real session and project authorization rather
than a demo read-key proxy. Keep SDK diagnostics in their separate project.

The local dashboard project should link back to the loopback-only harness, and
the harness should link to its recorded runs in the dashboard. These development
links and the fixture account/credentials must not be provisioned or enabled in
production. The harness remains strictly local and is never deployed.

## 6. Why the key tables exist, and what to simplify

The current schema separates two fundamentally different credentials:

| Current table          | Purpose                                                        | Security meaning                                                   |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| `project_api_keys`     | Server write keys for ingestion; read keys for API queries     | Secret bearer credentials, stored as hashes                        |
| `project_browser_keys` | Browser ingestion, origin allowlist, DB-backed request counter | Public identifiers with restricted ingestion behavior, not secrets |

These are **Flowmark's credentials for customer applications**, not the keys used
to connect Flowmark to Neon or Supabase.

Better Auth replaces the local dashboard login/read-key workaround, not server
SDK keys. A background job must still authenticate without a human session.

Browser keys are visible in browser bundles. Origin checks are useful browser
restrictions, not proof of a trusted sender: non-browser clients can spoof Origin.
Browser events remain untrusted, write-only, bounded, and rate-limited. A browser
key must never grant reads or server-ingestion privileges.

### Proposed cleanup

1. Present server credentials as **Ingestion keys** and browser credentials as
   **Browser ingestion keys** in UI/docs. Avoid ambiguous generic "API key" labels.
2. Add server-side key management: create, label, display once, revoke, rotate,
   and show a non-secret prefix/creation time. Never return stored hashes or log
   full keys. Never reuse the public local fixture credentials in deployment.
3. Use sessions for dashboard reads. Review whether programmatic read keys have
   an actual 0.1 user; remove/defer that capability only after checking consumers.
4. Keep browser and server credential validation distinct. Two tables are
   reasonable; merging them is not automatically simpler or safer.
5. Separate browser rate-limit accounting conceptually from credential identity.
   Preserve atomic multi-instance enforcement. A dedicated counter table is an
   option if it clarifies the implementation; Redis is not required.
6. Review whether direct project ownership can avoid exposing workspace complexity.
   Do not drop project scoping: it keeps independent apps and test data apart.

If browser ingestion is excluded from the initial release, explicitly gate it
and document that change. Do not silently delete an already supported SDK path.
This scope choice must be confirmed before schema changes.

## 7. Migrations, seeds, and onboarding are three different things

`pnpm db:setup` now splits into migrate and seed while keeping one contributor
command. `db:setup-demo` remains an alias. The local Better Auth account is
created by the same seed.

| Command                                                      | Responsibility                                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `pnpm db:migrate`                                            | Apply committed migrations only                                                     |
| `pnpm db:seed`                                               | Idempotently provision fixture projects/keys after explicit local-mode checks       |
| `pnpm db:setup`                                              | Migrate, then seed                                                                  |
| `pnpm dev:setup`                                             | Prepare missing local env files only, so `pnpm dev` does not require PostgreSQL     |
| `pnpm db:reset-local-telemetry -- --confirm-local-telemetry` | Explicitly delete only the local operations telemetry                               |

Rules:

- Development seed requires explicit local mode and a dedicated loopback database.
- Include the local development account and its Fieldwork Operations project
  access described above; document local sign-in credentials without reusing
  them in deployment.
- Running it twice must not duplicate rows or rotate credentials unexpectedly.
- Seed creates configuration, not fake workflow events. Recorded runs come through
  the SDK from the local harness; diagnostics remain isolated.
- Production onboarding creates real projects and randomly generated credentials.
  No fixed demo seed, default password, or published owner account in production.
- Run migrations once in a controlled CI/release step before compatible apps are
  promoted. Do not run them in every Vercel app build or on incoming requests.
- Use reviewed SQL migrations, not `drizzle push`, for shared/production databases.
- Prefer additive, backward-compatible migrations while old/new app deployments
  overlap; rehearse rollback and backup/restore before destructive changes.

Acceptance: a fresh local DB is usable with one documented setup command; the
seeded account can sign in through Better Auth, view the harness project's runs,
and follow a local link back to the harness without the demo read-key proxy.
A second execution is safe; the seed refuses production; an empty production DB
can be migrated and onboarded without editing tables manually.

## 8. Environment variables: typed, explicit, and isolated

Increment 2 uses the repository's existing Effect Schema settings and small
app-boundary checks instead of adding T3 Env. Preserve Effect's redacted
database settings and typed configuration errors inside API code. Revisit T3
Env only if those checks become hard to keep consistent across apps.

| Scope                | Expected variables                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| API runtime          | `DATABASE_URL`, auth secret/provider credentials, canonical auth URL, trusted dashboard origin |
| Migration process    | `DATABASE_MIGRATION_URL`                                                                       |
| Dashboard server     | `FLOWMARK_API_URL` and required auth-forwarding configuration                                  |
| Browser              | Only explicitly public URLs/configuration                                                      |
| Customer application | Its Flowmark endpoint and secret project ingestion key                                         |
| Local harness        | Local ingestion/diagnostic configuration only                                                  |

Validate required fields, URLs, and boolean values explicitly. No silent localhost
fallback in production. Demo mode must default off and be rejected in production.
Never prefix a secret with `NEXT_PUBLIC_` or import server env modules into client
bundles. Do not require database/auth secrets in landing or docs builds.

Keep per-app `.env.example` files with placeholders and public local-only values.
Use ignored local files for development, Vercel environment scopes for deployment,
and CI secrets for migrations/release. Give DB commands explicit env loading
rather than implicitly depending on the server app's directory.

Acceptance: missing/invalid configuration fails clearly, unrelated apps build
without backend secrets, and built client assets contain no private credentials.

## 9. Publish an installable npm SDK

Preserve the current public package name and entry points initially:

```ts
import { createFlowmark } from "@flowmark/node"
// Optional entry points:
// @flowmark/node/next
// @flowmark/node/browser
// @flowmark/node/proxy
// @flowmark/node/next/proxy
```

The SDK currently imports `@flowmark/core` at runtime. The simplest first release
is to publish **both** packages, core first, with explicit compatible versions.
Users install `@flowmark/node`; its dependency is resolved normally. Do not publish
a tarball containing unresolved `workspace:*`, missing compiled files, or imports
of private packages. Do not introduce a bundler or rename the SDK without need.

Release checklist:

- Confirm npm scope ownership and package-name availability.
- Confirm the license and add the actual license file; package manifests currently
  say MIT, but this is not a substitute for a repository license decision/file.
- Set public publishing metadata, repository links, package documentation, and
  supported Node/Next versions. Internal apps/API/DB/UI packages stay private.
- Build and test using the pinned toolchain; inspect packed manifests and files.
  Verify the pinned pnpm version rewrites workspace dependencies correctly.
- Install the packed core and SDK artifacts in a clean external consumer, outside
  this workspace. Test ESM/types, plain Node without Next installed, Next adapter,
  and browser entry-point bundling without Node-only modules.
- Smoke-test real delivery to a deployed isolated project, including rejected
  credentials, `flush()`/shutdown and Next response-lifecycle delivery.
- Publish a prerelease first, then promote 0.1.0 after the install smoke tests.
- Use a protected release workflow, npm trusted publishing/OIDC where supported,
  and a documented initial-publish bootstrap. Pin a compatible npm CLI for OIDC;
  do not assume the repository's pnpm automatically supplies that support.
- Keep SDK/core compatibility, changelog, tags, and API event compatibility explicit.
  Do not auto-publish every package on every push.

An existing `0.1.0` version in a manifest does not mean a release exists.

## 10. Ordered implementation increments

| Order | Increment                                                           | Done when                                                                  |
| ----- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1     | Confirm deployment, owner/auth-provider and browser scope decisions | Done: [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md)           |
| 2     | Standardize env boundaries and split migration/seed/setup           | Done: `db:migrate` / `db:seed` / `db:setup`, production seed refusal, and existing Effect Schema env checks. T3 Env was not added. |
| 3     | Add Better Auth, owner/project authorization and onboarding         | Done: anonymous reads fail; `local@dev` and new registrations get project-scoped sessions |
| 4     | Add ingestion-key management                                        | Done: dashboard create/revoke/rotate for write and browser keys; sessions and SDK credentials stay separate. |
| 5     | Deploy isolated preview with managed PostgreSQL                     | Auth, SDK ingestion and run investigation work outside localhost           |
| 6     | Add server-side run pagination and minimal data lifecycle           | Older runs remain findable; retention/delete/restore documented and tested |
| 7     | Verify packages and publish prerelease                              | Clean external consumers install and deliver telemetry successfully        |
| 8     | Release 0.1.0 with setup/operating docs                             | Real application integration and release checklist pass                    |

Carry forward the open items from [NEXT-PHASE-PLAN.md](./NEXT-PHASE-PLAN.md):
natural instrumentation in a real app, independent reader feedback, a modest
logs/trace comparison, and evidence for any cross-run business insight. None is
magically completed by adding hosting and auth. Decide explicitly whether the
cross-run criterion is deferred from 0.1 rather than adding misleading aggregates.

### Minimum operational checks

- Unauthorized session and API-key paths fail without leaking project data.
- Local fixture credentials and demo mode cannot be used in production.
- Ingestion limits, existing deduplication and project isolation work in deployment.
- API failures are visible through structured server errors and health checks;
  no success-shaped response when persistence fails.
- SDK telemetry problems preserve application behavior while exposing delivery
  diagnostics; serverless lifecycle delivery is tested, not assumed.
- Preview traffic and migration jobs cannot accidentally change production data.
- A production backup can be restored, and telemetry can be removed deliberately.

## 11. References

Official guidance consulted for this plan; recheck against pinned versions when
implementing:

- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Vercel custom domains](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)
- [Neon connection methods on Vercel](https://neon.com/docs/guides/vercel-connection-methods)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Better Auth with Next.js](https://www.better-auth.com/docs/integrations/next)
- [Better Auth Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)
- [T3 Env](https://env.t3.gg/docs/introduction)
- [pnpm publishing](https://pnpm.io/cli/publish)
- [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)
