# Development guide

## Requirements

- Node.js 20.19 or newer (Node 24 LTS recommended)
- pnpm 10

Install dependencies from the repository root:

```sh
pnpm install
```

## Run apps

```sh
pnpm --filter @flowmark/web dev        # http://localhost:3000
pnpm --filter @flowmark/dashboard dev  # http://localhost:3001
pnpm --filter @flowmark/docs dev       # http://localhost:3002
pnpm --filter @flowmark/server dev     # http://localhost:3003
pnpm --filter @flowmark/dev-harness dev # http://127.0.0.1:3004 (local only)
pnpm --filter @flowmark/internal-docs dev # http://127.0.0.1:3005 (local only)
```

`apps/dev-harness` is an internal development fixture, not a public demo or a
deployable app. Its Next.js commands bind to `127.0.0.1`; do not change that
binding or expose the harness to a network.

`apps/internal-docs` renders this directory as contributor documentation. It
has no authentication, binds to loopback, and must not be deployed or exposed
publicly. Customer SDK documentation is served separately by `apps/docs`.

`pnpm dev` starts the six apps, Drizzle Studio, and the SDK/core build watchers through
Turborepo's interactive terminal UI (TUI). The SDK build depends on the core
build, and both watch for source changes. Use arrow keys or `j`/`k` to select a
task, `m` for help, and `Ctrl+C` to stop; `pnpm dev:stream` runs without the
TUI. To run only the local dev harness while preserving Turbo's SDK/core build
prerequisites, use `pnpm dev --filter=@flowmark/dev-harness`. If you invoke
`pnpm --filter @flowmark/dev-harness dev` directly, first build its workspace
dependency with `pnpm --filter @flowmarkdev/node... build`. Do not launch a direct
build concurrently with the root dev watchers.

Before starting Turbo, `pnpm dev` runs `pnpm dev:setup`: it copies the three
public local-demo `.env.example` templates to missing `.env.local` files.
Existing `.env` or `.env.local` configuration is never overwritten and
configuration values are never printed. This is repository development setup,
not an SDK fallback or production credential provisioning.

Starting development apps does not start PostgreSQL or apply migrations.
Set `DATABASE_URL` in `apps/server/.env.local` to an existing development database,
then run `pnpm db:setup`. That command reads the server app's environment
files, applies committed migrations, and seeds local fixture projects so the API
uses the same database. `pnpm db:migrate` and `pnpm db:seed` are available
separately. Seed refuses production and non-loopback databases. Shell environment
values take precedence. The relevant exported environment variables are forwarded
into Turbo's dev tasks; Next.js loads each app's own `.env.local`.
Seed also creates `local@dev` so you can sign in to the operations project.

### Database browser: Drizzle Studio

```sh
pnpm db:studio
```

Open https://local.drizzle.studio after the local server starts. Studio binds
only to `127.0.0.1:4983` and starts automatically with `pnpm dev`.
Use `pnpm db:studio` to run it separately.
Drizzle Kit is already installed in the database package.

Studio reads the same server `.env.local` / `.env` files as demo setup.
An exported `DATABASE_URL` takes precedence. Use a dedicated development
database: Studio can edit and delete records, not just inspect them.
Never expose its local server publicly or share connection credentials.
The browser UI is served by Drizzle, separately from our local API; follow
your team's data-access policy before connecting sensitive databases.

This works with any PostgreSQL, including local, Neon, or Supabase PostgreSQL:
update `DATABASE_URL` to the intended connection string (with the provider's
required TLS settings), then restart Studio. Provider-specific auth, Storage,
and other services are not configured by Studio.

The reference Neon project is a separate database. Its operating notes are in
the [infrastructure guide](./infrastructure). Local demo setup keeps
`DATABASE_URL` on loopback. Do not point Studio, `pnpm db:setup`, or
`pnpm db:seed` at that project. Preview deployments must not use the
production database or `https://api.flowmark.dev`.
`pnpm db:migrate:preview` applies committed migrations to the Neon `preview`
branch only. It refuses a production, loopback, or non-Neon host. The branch
is created by an approved operator step, not by a Vercel build.
`pnpm db:migrate:staging` is the same guard for the Neon `staging` branch. It
also refuses the preview host. Neither command runs from a Vercel build.

### Applying migrations safely

The [database rollout guide](./migrations.md) is the source of truth for feature
PR vs release gates, migration-before-deploy ordering, protected Actions setup,
and workstation fallback. Include schema, SQL/Drizzle metadata and the complete
stack change in the same PR. Local/CI verification completes implementation;
Production migration belongs to release, not ordinary feature PR completion.

Bare `pnpm db:migrate` accepts loopback only. Existing environment wrappers and
the controlled merge pipeline or approved standalone **Migrate database** job delegate to that guarded command.
Ordinary PR checks receive no hosted credentials. Never seed Neon or migrate
inside Vercel builds/requests. See the guide for exact commands and approvals.

The dashboard uses a same-origin server proxy for tRPC and Better Auth. Its
server-side `FLOWMARK_API_URL` defaults to `http://localhost:3003`. Dashboard
reads use the signed-in session; workflow queries read PostgreSQL, not mock
data.

The local dev harness records server workflows through the private
`POST /v1/events` endpoint and browser workflows through direct
`POST /v1/browser-events` delivery. Its browser key is intentionally public,
restricted to the local harness origins, and limited to 120 requests per minute per key.
Browser events are untrusted telemetry. Never put a private write key in a
browser bundle or `NEXT_PUBLIC_*` variable.

### SDK development catalog

Open http://127.0.0.1:3004/diagnostics. The runtime tabs
run the same small cases in Browser, Next.js, or plain Node mode:

| Group                   | Cases                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Runs and data           | Basic lifecycle; context amendments, step properties and results                       |
| Errors                  | Handled error; intentional terminal failure                                            |
| Operations and progress | Manual/callback operations; callback rejection; deferred completion; absolute progress |
| Related runs            | Explicit correlation and parent/child run links                                        |

Each case lists its SDK methods, expected telemetry, external run IDs and
workflow names. Browser and plain Node cases use a fresh client,
`flush()`, then `shutdown()`; Next cases use request-scoped `after()` delivery.
Intentional failures remain in a separate SDK diagnostics project's history,
never the operations dashboard. Re-run `pnpm db:setup` to provision that
project and its loopback-only browser/write credentials.

The editable cases live in `apps/dev-harness/lib/sdk-scenarios.ts`; browser
controls live in `app/sdk-playground.tsx`, and server runtime selection and
input validation in `app/api/sdk-tests/route.ts` (relative to the harness app).
The main harness is a fictional operations app with invoice import, inventory
sync and order fulfillment. Choose a case or **Run all six scenarios** to
generate real SDK telemetry for its simulated work. See the
[harness guide](../apps/dev-harness/README.md) for outcomes and implementation.

These are manual integration checks, not assertions that replace automated
SDK tests. Run each case once when checking browser delivery: the local browser
key shares a 120-request/minute quota across local clients.

The server allows the local dashboard origin by default. The reference
deployment sets `FLOWMARK_DASHBOARD_ORIGIN` and `BETTER_AUTH_URL` to
`https://app.flowmark.dev`. The full local and production catalog is in
the [infrastructure guide](./infrastructure).

The framework-independent use cases, ports, and persistence adapters are in
`packages/api` (`@flowmark/api`). The current `apps/server` Next.js application
contains only the deployment shell and protocol orchestration, so another
server/framework can compose the same API services without importing Next.js or
tRPC. In practice, a new Hono, Express, or GraphQL host should be a separate
app that depends on `@flowmark/api`; it should decode its own requests, call
the matching Effect service, and map typed outcomes to its own response format.
The shared use cases and project-scoping rules stay in the package.

Run application and database-adapter tests with
`pnpm --filter @flowmark/api test`; run HTTP and tRPC boundary tests with
`pnpm --filter @flowmark/server test`.
Build the reusable package before consuming its compiled entry point with
`pnpm --filter @flowmark/api build`. The dashboard imports the router type from
`@flowmark/server/trpc`; that integration is a compile-time contract and does
not move tRPC into the API package.

Dashboard UI primitives follow shadcn conventions and live in `packages/ui`. Add generated shadcn components there so the package remains the shared source.

## Checks

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm build
```

Prettier enforces semicolon-free formatting. ESLint requires braces around all control-flow bodies, including single-line `if` statements.

SDK and core behavior are covered with Vitest, including HTTP failures and the
Next.js delivery lifecycle. Domain validation and delivery are composed as
Effects; only explicit application/SDK boundaries execute them. Apps can build
without a database, but workflow ingestion and queries require PostgreSQL.

All Effect consumers use pinned Effect 4.1.0. The
[migration notes](./effect-v4-migration.md) cover native v4 conventions,
advanced SDK compatibility, and the local mocked-delivery benchmark. Keep the
version aligned across packages; check the installed Effect sources/declarations
before adapting APIs, especially HTTP and Schema.

API unit tests run without PostgreSQL using injected authorization/repository
services. They cover lazy ingestion, Schema validation, project scoping, typed
failures, redacted settings, and scoped connection cleanup on success, failure,
and interruption. Run them with `pnpm --filter @flowmark/api test`. Server HTTP
integration coverage runs with `pnpm --filter @flowmark/server test` and needs
`TEST_DATABASE_URL` as described below.

## Environment and database

Self-hosting uses the same apps and committed migrations with any PostgreSQL
you control. The reference deployment on Neon and Vercel is documented for
maintainers, not as a second product tier you must purchase to run the code.

Local demo and the reference deployment are different environments. Do not
copy Vercel values into `.env.local`, and do not point local demo at Neon.
The [infrastructure guide](./infrastructure) lists every variable, which
process reads it, and the value used in each environment.

Run `pnpm dev:setup` (or copy the relevant `.env.example`) to configure local
demo mode. The API needs a loopback `DATABASE_URL` and
`FLOWMARK_DEMO_MODE=true`. The dashboard uses the same demo-mode flag and
`FLOWMARK_API_URL=http://localhost:3003`. The dev harness's
`FLOWMARK_API_KEY` is used by its server route only. Landing and customer
docs need no local env file. Demo mode defaults off and is rejected when
`NODE_ENV` or `VERCEL_ENV` is production. Hosted API use sets
`BETTER_AUTH_SECRET` on Vercel. Local demo mode falls back to a development
secret and must not reuse it in production.

### Runtime environment validation

Flowmark keeps Effect Schema for environment validation because it already provides
typed configuration errors at the API and dashboard boundaries. The missing piece
was consistent validation of the server's auth and CORS origins, which now share
one request-time reader. Adding t3-env would duplicate that boundary without
justifying another dependency.

Hosted API requests require `FLOWMARK_DASHBOARD_ORIGIN` and `BETTER_AUTH_URL`;
both must be HTTP(S) origins without credentials, paths, query strings, or
fragments. Local development defaults to `http://localhost:3001`. The dashboard
requires `FLOWMARK_API_URL` in production and Preview, accepts HTTP(S) URLs
without credentials, query strings, or fragments, and defaults to
`http://localhost:3003` only locally. Invalid configuration produces a typed
runtime error rather than silently choosing localhost. Error messages name the
setting without including its configured value.

Branch Preview deployments continue deriving sibling API/dashboard origins from
the Git branch. Staging continues requiring its dedicated staging origins; these
checks do not restrict self-hosted production instances to Flowmark's domains.
Demo mode remains forbidden in Production and Preview, including Staging.
Validation runs on requests rather than module import: server and dashboard builds
do not require a database, auth secret, or hosted origin configuration. Database
CLI and SDK configuration are unchanged.

Database schema lives in `packages/db/src/schema`. Set `DATABASE_URL` when generating Drizzle migrations:

```sh
pnpm db:generate
```

Versioned migrations are in `packages/db/migrations`. The API requires
`DATABASE_URL`; it returns explicit errors if storage is unavailable.

## Local demo with PostgreSQL

Use a dedicated PostgreSQL database. Dashboard sign-in is email and password.
The seed creates `local@dev` / `local-dev-only` and attaches it to the local
operations project. Applications still use a project write key, not that
password.

```sh
createdb flowmark
pnpm dev:setup
# Set DATABASE_URL in apps/server/.env.local to the database you just created.
pnpm db:setup
pnpm dev
```

This applies committed migrations and provisions the operations and SDK
diagnostics projects idempotently. It creates development-only read,
server-write, and browser-write keys. Diagnostics use separate write/browser
credentials and do not appear in the operations dashboard. Do not run seed or
setup against production or a non-loopback database. Do not run it against a
database that already has these tables from an unmanaged schema push;
reconcile/migrate that schema first. Set the same `DATABASE_URL` in the API
environment. Optional `DATABASE_MIGRATION_URL` is used only by migrate
commands. The three local development app configurations are:

- API: `DATABASE_URL`, `FLOWMARK_DEMO_MODE=true`.
- Dashboard: `FLOWMARK_DEMO_MODE=true`, optional server-only `FLOWMARK_API_URL`.
- Local dev harness: operations use the server key
  `FLOWMARK_API_KEY=fm_demo_write_local_only`. Diagnostics explicitly use
  `fm_diagnostics_write_local_only` on the server/proxy and the public
  `fm_diagnostics_browser_local_only` from `flowmark.config.ts` in the browser.
  Its server API URL can be overridden by `FLOWMARK_API_URL`; the browser
  config sets its own public API origin.

Then start API (3003), dashboard (3001) and the local dev harness (3004), using the commands
above. Sign in to the dashboard as `local@dev` with password `local-dev-only`.
Click **Run all six scenarios** in the harness and open the dashboard's
Workflows page. You should see `invoices.import`, `inventory.sync` and
`orders.fulfill`, with two runs each. The dashboard refreshes every three seconds.
Click a run to inspect its business result, progress, errors and operations.
Registering a new email creates a separate project; it does not see the seeded
harness data.

To discard the operations project's old local telemetry explicitly:

```sh
pnpm db:reset-local-telemetry -- --confirm-local-telemetry
```

The reset requires demo mode and a loopback database. It deletes only that
project's workflow events, runs and definitions, in a transaction. Accounts,
keys, diagnostics and other projects are retained. Nothing resets on startup.
Record fresh data using the harness, not direct SQL inserts.

Demo read and server-write credentials (`fm_demo_read_local_only` and
`fm_demo_write_local_only`) are development-only and must remain server-side.
The browser credential (`fm_demo_browser_local_only`) is intentionally public;
the API restricts it to loopback origins on ports 3004 and 5173 (`localhost`
and `127.0.0.1`).
Only hashes of credentials are stored. The API rejects demo credentials unless
explicitly in demo mode. Dashboard reads use the signed-in session, not the
demo read key. Never store real customer data in this shared demo project.

SDK delivery handles timeout/retries and idempotent event UUIDs. The Next.js
server adapter drains delivery after the response; direct browser delivery uses
the browser-events API and can be lost on shutdown or offline operation.
Telemetry failure does not undo application work. Business data is simulated
independently for each execution; the UI's recent-execution list resets on
reload, but workflow history does not.

### Database integration tests

The PR workflow has a separate **PostgreSQL integration tests** job with an
empty Postgres 18 service container. It builds API/database dependencies,
applies committed migrations, and runs the server tests with `TEST_DATABASE_URL`.
It rejects a report containing skipped tests. The fast `pnpm check` job remains
independent and has no database credentials. No Neon credentials or demo seed
are used; HTTP tests create their own isolated projects and keys.

To run the same tests locally, choose a disposable loopback database. Do not use
the local demo database or any hosted database. Tests write rows; discard this
database when finished. For example, with an existing local PostgreSQL server:

```sh
createdb flowmark_test
pnpm --filter @flowmark/api... build
DATABASE_URL=postgresql://127.0.0.1:5432/flowmark_test \
DATABASE_MIGRATION_URL=postgresql://127.0.0.1:5432/flowmark_test \
  pnpm db:migrate
TEST_DATABASE_URL=postgresql://127.0.0.1:5432/flowmark_test \
  pnpm --filter @flowmark/server test
```

Adjust role, port, and database name for your own local server. Export both
migration URLs explicitly so server env files cannot redirect the migration.
No `db:setup` or `db:seed` is needed. Without `TEST_DATABASE_URL`, normal server
unit runs skip the database suites; the integration CI job must run them.
These tests cover ingestion, idempotency, browser quotas, and project isolation.
The authenticated ingestion suite now covers registration → sign-in → project
and key creation → ingestion → persisted-run read with a real Better Auth
session, with demo mode off. It also checks that project headers and management
inputs cannot grant another user's access, and that signed-out sessions fail.

| Boundary                  | Test coverage                                                                                                                                                                                                                                     | CI job                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Register and sign in      | [`authenticated-ingestion.test.ts`](../apps/server/test/http/authenticated-ingestion.test.ts) uses the registration and Better Auth HTTP handlers and their actual session cookies                                                                | PostgreSQL integration tests                 |
| Create project and key    | Same suite calls session-authenticated tRPC procedures; verifies stored key hash and secret-free key listing                                                                                                                                      | PostgreSQL integration tests                 |
| Ingest                    | Same suite uses the actual events route; [`ingestion.test.ts`](../apps/server/test/http/ingestion.test.ts) and [`browser-ingestion.test.ts`](../apps/server/test/http/browser-ingestion.test.ts) add idempotency, validation, origins, and quotas | PostgreSQL integration tests                 |
| Persist                   | Authenticated suite reads the reported terminal result from PostgreSQL                                                                                                                                                                            | PostgreSQL integration tests                 |
| Read                      | Same suite reads project snapshot and run timeline using the signed-in user's cookie                                                                                                                                                              | PostgreSQL integration tests                 |
| Deny cross-project access | Authenticated suite checks sessions, forged project headers, key listing/creation and project renaming; ingestion suite checks another project's read key                                                                                         | PostgreSQL integration tests                 |
| Refuse demo credentials   | [`workflows.test.ts`](../packages/api/test/features/workflows.test.ts) checks read/write/diagnostics keys before storage; HTTP suites check server/browser demo-key refusal                                                                       | Fast checks and PostgreSQL integration tests |

These are in-process route/API integration tests with the real auth and
persistence implementations. They do not launch a Next.js server or browser,
render dashboard UI, or verify the hosted dashboard proxy, cookie domain,
SameSite behavior, or cross-origin deployment setup. Verify those in Staging
when affected; no Playwright dependency is required for this API coverage.

### Connection lifecycle verification

The authenticated ingestion suite also measures retained database connections
through `pg_stat_activity`. It adds a random `application_name` to its runtime
connection URL and counts only that name, excluding the observer and other
suites. Four waves each run six concurrent session checks, two-event ingestions,
and authenticated project reads. The retained count must stay within the cached
auth pool's default maximum of ten. A final ingestion-only wave must return to
the same retained count, verifying that API pools are closed.

Run the existing server integration command above with a dedicated disposable
local database; the result prints a baseline and four post-wave counts. A local
PostgreSQL 16 run observed `1 → 6 → 6 → 6 → 6`. No driver, auth adapter, pool
setting, or lifecycle redesign was needed. This measures one test process, not
the total connections across Vercel instances or Neon capacity. Do not generate
production traffic or change production driver settings as part of this check.

## Troubleshooting local data

### Health and failure diagnostics

`GET /api/health` is liveness only: a 200 means the API process responds, even
when PostgreSQL is unavailable. It does not verify authentication, ingestion,
or database readiness. Keep this single database-independent health route;
there is no `/api/ready` route or automated readiness check. Use relevant
Staging smoke tests when a change needs database/auth verification rather than
adding database work to every liveness request.

```sh
curl --fail http://127.0.0.1:3003/api/health
```

| Signal                                              | Meaning                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| API health 200                                      | Process responds; database may still be unavailable                                       |
| Ingestion 503, `Event storage is unavailable.`      | API could not complete storage work; not a successful write                               |
| Dashboard proxy 500                                 | Dashboard API configuration is missing or invalid                                         |
| Dashboard proxy 502, `Flowmark API is unavailable.` | Dashboard could not reach its upstream API                                                |
| Upstream response forwarded by proxy                | The upstream status is preserved, including a 503; it is not converted to a transport 502 |

`[Flowmark API] Request failed` logs safe structured metadata: known failure
types, allowlisted database operations, selected network/PostgreSQL codes,
defects, and interruption state. For example, `authenticate` with
`ECONNREFUSED` points to database connectivity while resolving an ingestion key.
Unknown labels/codes are omitted or reported as unknown. Raw causes, messages,
stacks, SQL, bound values, URLs, and credentials are intentionally not logged.
Original typed errors remain available inside the Effect error channel.

Dashboard transport logs use `[Flowmark dashboard] API request failed` with a
safe `DashboardProxyError` label, without the raw fetch error or endpoint URL.
Do not restore raw exception dumps to debug an incident; inspect local/hosted
configuration through the appropriate operator tools without copying secrets.

Regression coverage includes an actual refused loopback database connection
in the Postgres integration CI job, synthetic nested/compound error causes,
and dashboard configuration/transport/status-forwarding tests. No existing
development database needs to be stopped to run those tests.

### Local data checks

- `FlowmarkConfigError` mentioning `apiKey`: the harness server did not receive
  `FLOWMARK_API_KEY`. Run `pnpm dev:setup` and restart the dev command if the
  process predates the local environment files. Never fix this with a public
  browser key or a production default credential.
- Dashboard asks you to sign in: use `local@dev` / `local-dev-only` after
  `pnpm db:setup`, or register a new account. Anonymous reads are rejected.
- API returns storage/configuration errors: check `DATABASE_URL`, PostgreSQL
  reachability, and run `pnpm db:setup` against that same database.
- A browser key works only from its configured origin. The local harness allows
  loopback ports 3004 and 5173; a different port requires an explicit allowlist
  change, not a wildcard CORS bypass.
- If port 3000 belongs to another project, use `PORT=3100 pnpm dev`. The web app
  moves to 3100; dashboard/docs/API/dev harness keep ports 3001 through 3004.

The dashboard's Appearance selector supports system, light, and dark themes,
persists the selection, and applies it before hydration. Nonfunctional project,
billing, notification, and search controls are intentionally not shown.

## Pull requests and application releases

Start normal feature and infrastructure branches from current `origin/staging`
and open PRs explicitly targeting `staging`. Run `pnpm check` before pushing.
Staging accumulates approved changes; a release PR from `staging` into `main`
triggers the existing Vercel Production deploys after an approved merge.

See [application releases](./releases.md) for merge methods, branch
synchronization, schema deployment order, release notes, and verification.
The repository `pull-request` and `release` agent skills perform these steps
when requested. App releases do not publish SDK packages.

## SDK publishing

`packages/sdk` is published as `@flowmarkdev/node` (with `@flowmarkdev/core`).
Release uses a protected GitHub Actions workflow and npm trusted publishing.
Do not publish from a laptop except for the documented bootstrap.

## Compact historical projections

See [historical facts](historical-facts.md) for same-lifetime projection semantics,
local bounded dry-run/backfill/checkpoint commands, repair and rollout gates.
Facts do not extend the reference deployment’s 30-day telemetry retention.
