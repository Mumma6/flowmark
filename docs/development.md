# Development guide

## Requirements

- Node.js 20.19 or newer (Node 24 LTS recommended)
- pnpm 10.18.1 (pinned in `package.json`)
- Docker CLI and Compose supporting `up --wait`,
  `--wait-timeout`, and `--no-recreate`; OrbStack, Docker Desktop (Linux
  containers), and Docker Engine on Linux use the same commands.

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

All application dev servers bind to `127.0.0.1`. Next.js also permits `localhost`
for dev resources; explicit binding makes the documented IPv4 loopback URL work
without broadening `allowedDevOrigins`. Open the dashboard on `localhost:3001`,
matching the exact Better Auth origin in the server template; browser cookies
and sign-in origins are hostname-specific.

`pnpm dev` starts the API, dashboard, local harness and native compiler watchers
for core, SDK, db, API and auth. All five libraries finish their initial builds
in dependency order before any watcher or app starts. The shared `dev:ready`
task prevents initial builds and watchers from racing into the same `dist`
directory. Subsequent edits rebuild automatically; exports point at built files.

```sh
pnpm dev                         # daily product development
pnpm dev --ui=stream             # ordinary logs for agents/non-interactive terminals
pnpm dev:all                     # also web, docs and internal-docs
pnpm dev:stack                   # PostgreSQL, all apps, and Drizzle Studio
pnpm db:studio                   # Studio alone, when the apps are already running
```

`pnpm dev` and `pnpm dev:all` do not start Studio. `pnpm dev:stack` does.
Docs-only work can
use `pnpm --filter @flowmark/docs dev` without Docker or backend builds.
Turbo's TUI supports arrow keys or `j`/`k`, `m` for help, and `Ctrl+C` to stop.
Exported `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` reach native dev tasks;
they remain private server settings, not `NEXT_PUBLIC_*` configuration.

Keep one dev-session owner per checkout. Inspect processes and ports before
starting; use an existing session when appropriate. Stop only your own session.
Do not run another compiler, direct build, integration command or workspace
check beside active dev watchers: they share build outputs. Stop your own dev
session first, or use another worktree. Direct app commands bypass orchestration
and require their workspace dependencies to have been built first.

Before starting Turbo, `pnpm dev` runs `pnpm dev:setup`: it copies the three
public local-demo `.env.example` templates to missing `.env.local` files.
Existing `.env` or `.env.local` configuration is never overwritten and
configuration values are never printed. This is repository development setup,
not an SDK fallback or production credential provisioning.

`pnpm dev` and `pnpm dev:all` check Compose readiness before starting
applications. They do not start PostgreSQL, apply migrations or seed data.
`pnpm dev:stack` is the explicit full start: it prepares env files, runs
`pnpm infra up`, then starts every application, the library watchers, and
Drizzle Studio. It still does not migrate or seed. Run `pnpm db:setup` once
before recording data.
Run `pnpm infra up` after env setup. Then run
`pnpm db:setup`. That command reads the server app's environment
files, builds `@flowmark/db` and its workspace dependencies (including core), applies committed migrations, and seeds local
fixture projects so the API uses the same database. `@flowmark/auth` then
provisions `local@flowmark.test`. `pnpm db:migrate:local` and `pnpm db:seed` are
available separately. Project fixtures stay in `@flowmark/db`; the local
account stays in `@flowmark/auth`. Seed refuses production and non-loopback
databases. Shell environment values take precedence. The relevant exported
environment variables are forwarded into Turbo's dev tasks; Next.js loads each
app's own `.env.local`. The fixture uses Better Auth's standard email/password
login. Seeding remains restricted to explicit demo mode and loopback databases.
It does not run on application startup.

Setup, seed, Studio and local migrations require the same checked Compose target.
The optional migration URL must name the same host, port, database and role;
commands use the runtime URL's credentials. Shell values retain precedence.
A conflicting override fails before SQL; no command silently redirects it.

### Local PostgreSQL with Compose

Use the same standard Docker CLI/Compose workflow with OrbStack, Docker
Desktop, or Docker Engine on Linux. No runtime-specific socket path, domain,
CPU architecture, or host networking is configured. Applications, watchers,
Drizzle, and tests remain native pnpm processes.

For a new checkout:

```sh
pnpm dev:setup
pnpm infra doctor
pnpm infra up
pnpm db:setup
pnpm dev --ui=stream
```

`doctor` checks the selected local engine and configuration; an absent/stopped
service is reported with `databaseReady: false` and startup instructions.
`up` starts only this checkout's `postgres`, waits at most 30 seconds for
health, and checks the database/role inside the container. It never migrates,
seeds, or resets. A healthy container does not prove schema readiness; apply
reviewed migrations explicitly with `pnpm db:migrate:local` when needed.

The default is PostgreSQL 18 (`postgres:18-alpine`, matching CI), published at
`127.0.0.1:55432`, with public local-only role/database `flowmark` and password
`local_dev_only`. PostgreSQL data is stored in a project-scoped named volume
mounted at `/var/lib/postgresql`, the PostgreSQL 18 image location. Normal
stop/start and container recreation retain this volume. Initialization settings
only create roles/databases in an empty data directory; changing container env
does not change an existing database password. Do not change the major version
or remove the volume to fix a startup problem.

The root `compose.yaml` defines development PostgreSQL and the isolated
`postgres-test` service used only by the integration runner. Project and volume
identities are derived from the checkout's real path, so worktrees/clones do
not share ownership. Moving a checkout changes its project identity; it does
not move/delete the previous volume or its data. Two active checkouts need
different host ports: choose `FLOWMARK_POSTGRES_PORT` and the matching runtime
URL explicitly. A port conflict never authorizes stopping the port owner.

### Existing local data

Docker Compose is the only supported local infrastructure provider. There is no
provider selector or unmanaged PostgreSQL path. Local database commands validate
the checkout's container/project/volume labels, image, loopback port, credentials,
mount, health and SQL database/role identity before accessing data.

`dev:setup` preserves existing `.env`/`.env.local` files. If a previous setup used
another database, compare `apps/server/.env.local` with `.env.example` and
explicitly set the documented Compose URL and port. Remove the old
`FLOWMARK_LOCAL_DATABASE` setting; it no longer selects a provider. Setup does
not transfer data or retire an old service. Preserve any old database, container
or volume until its data has been assessed and a separate transfer is approved.
A fresh Compose instance is a different database, not a copy of the old one.
Only `application_name` is accepted as an additional local URL option.

### Infrastructure commands and ownership

There is one command dispatcher, `pnpm infra <operation>`, rather than separate
script files for each operation:

- `doctor`: check the effective Docker target, engine, config, port/service and
  readiness; migration state is explicitly not checked. `--require-ready` fails
  for an absent/stopped/unhealthy service and is used by the root dev commands.
- `up`: start/wait without recreating an existing container. Output includes
  `container` and `startedByThisCall`; a previously running service is left as-is.
- `status`: show this checkout's container/health state, including absent/stopped.
- `logs`: return the last 100 container log lines, including stderr, and redact
  PostgreSQL connection URLs. Review logs before sharing; SQL may contain local data.
- `restart postgres`: restart only the verified service and wait for health.
- `down`: stop only the verified service; retain its container and named volume.

Agents must record whether they started a service and its returned container ID.
Coordinate infrastructure operations within one checkout; the reported startup
snapshot is not a cross-process lease. Separate worktrees have separate ownership.
For cleanup, use `pnpm infra down --container <id>` only when `startedByThisCall`
was true; a stale/mismatched ID is refused. Leave previously running services
alone. Explicitly requested manual stop/restart is scoped to this checkout.
There is no automatic cleanup on dev exit or failed startup; inspect status/logs
before deciding what your session owns. Never use `down -v`, volume deletion,
or prune as a repair step without approval. `infra up` deliberately does not
recreate containers. Use `pnpm infra up --recreate` only deliberately after
reviewing the change and confirming service ownership (or an explicit user
request); it recreates only the verified service and retains its named volume.
It never changes the PostgreSQL major version or repairs configuration drift
by taking over an unrecognized container/volume.

Docker target selection respects `DOCKER_CONTEXT` and checks `DOCKER_HOST` for
conflicts; commands pin the inspected context for that invocation without
switching the global context. Remote/ambiguous endpoints and target-changing
Compose overrides are refused. Turbo forwards these overrides to native dev tasks.
Root `.env` files are not a second Compose
configuration source; the dispatcher supplies only the checked local values.

OrbStack and Docker Desktop run separate engines. Containers and volumes appear
in the UI for the engine selected by `docker context show`, even if both runtimes
are running. `docker context ls` lists their endpoints. Choose the intended
local engine explicitly before starting work; repository commands never switch
it automatically or move data between engines.

If Docker is unavailable, start your chosen engine manually and retry. If socket
access is denied by permissions or an agent sandbox, report the limitation.
For an authorized local task, a normal, narrowly scoped tool approval may permit
verification outside the sandbox; it does not authorize socket permission
changes or bypassing security controls. If permitted access is unavailable or
rejected, use command-boundary tests and leave container/data verification
pending. Do not switch engines/contexts silently or fall back to a hosted database.

### Command reference

The daily path is env setup → `infra up` → `db:setup` once → `dev`.
`pnpm dev:stack` combines env setup, `infra up`, all applications, and
Drizzle Studio for a later session. Subsequent schema updates use
`db:migrate:local`; `db:seed` provisions fixtures without migrating.
PostgreSQL provisioning/health belongs to Compose; database safety checks stay
in the repository. Hosted migration, release and publication commands keep
their separate approval gates.

See [developer commands](./development-commands.md) for the complete command and
script inventory, including which aliases were removed and why.

Runtime references: [Compose startup options](https://docs.docker.com/reference/cli/docker/compose/up/)
and [PostgreSQL image storage/initialization](https://hub.docker.com/_/postgres).

### Database browser: Drizzle Studio

```sh
pnpm db:studio
```

Open https://local.drizzle.studio after the local server starts. Studio binds
only to `127.0.0.1:4983` and runs only when explicitly started.
Drizzle Kit is already installed in the database package.

Studio uses a separate guarded local config, `packages/db/drizzle.studio.config.ts`.
It reads the same server `.env.local` / `.env` files as demo setup and requires
demo mode, the verified checkout-owned Compose database, and a non-production environment.
An exported `DATABASE_URL` takes precedence. A configured migration URL must
match the runtime target; Studio uses only the runtime URL's connection settings.
Use a dedicated development
database: Studio can edit and delete records, not just inspect them.
Never expose its local server publicly or share connection credentials.
The browser UI is served by Drizzle, separately from our local API; follow
your team's data-access policy before connecting sensitive databases.

This repository's Studio command is local-only. It refuses hosted targets and
conflicting migration overrides before Studio starts. The shared
`drizzle.config.ts` still selects `DATABASE_MIGRATION_URL` for migration tooling;
the hosted migration wrappers and approval rules are unchanged. The reference
hosted database is Neon; see [ADR 0006](./decisions/0006-mvp-0.1-infrastructure.md).

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

`pnpm db:migrate:local` requires the checkout-owned Compose database. The shared
`pnpm db:migrate` entrypoint additionally accepts proven disposable-test targets
or an exact hosted target authorized by its environment wrapper. The controlled
merge pipeline and approved standalone **Migrate database** job use those wrappers.
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

`pnpm check` is the pull-request gate: format, lint, typecheck, and unit tests.
It does not run the disposable-Postgres integration job.

```sh
pnpm check
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
Hosted resource and persistent configuration changes use the
[Pulumi writer policy](./infrastructure.md#pulumi-is-the-infrastructure-writer).
Provider CLI/connector reads may inspect settings; provisioning or changing them
requires the existing Pulumi program and an approved exact-stack plan. Drizzle
migrations and local loopback setup remain separate workflows.

The [infrastructure guide](./infrastructure) lists every variable, which
process reads it, and the value used in each environment.

Run `pnpm dev:setup` to configure local demo mode. The API uses the
checkout-owned Compose `DATABASE_URL` and
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

Use the checkout-scoped Compose instance above. Development and demo fixtures
share that persistent local database; operations and SDK diagnostics use
separate project IDs and credentials. Integration tests use another PostgreSQL
instance and never reset either project.
Dashboard sign-in is email and password.
The seed creates `local@flowmark.test` / `local-dev-only` and attaches it to the local
operations project. Applications still use a project write key, not that
password. On first sign-in, continue onboarding with the existing project/key.
Run the six harness scenarios to supply the first runs, then finish onboarding;
no additional project or write key is needed for the local harness.

```sh
pnpm dev:setup
pnpm infra up
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
environment. Local commands require any `DATABASE_MIGRATION_URL` override to name the same
Compose target, then use `DATABASE_URL`. The three local development app
configurations are:

- API: `DATABASE_URL`, `FLOWMARK_DEMO_MODE=true`.
- Dashboard: `FLOWMARK_DEMO_MODE=true`, optional server-only `FLOWMARK_API_URL`.
- Local dev harness: operations use the server key
  `FLOWMARK_API_KEY=fm_demo_write_local_only`. Diagnostics explicitly use
  `fm_diagnostics_write_local_only` on the server/proxy and the public
  `fm_diagnostics_browser_local_only` from `flowmark.config.ts` in the browser.
  Its server API URL can be overridden by `FLOWMARK_API_URL`; the browser
  config sets its own public API origin.

Then start API (3003), dashboard (3001) and the local dev harness (3004), using the commands
above. Sign in to the dashboard as `local@flowmark.test` with password `local-dev-only`.
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

Run the complete database/server sequence locally with:

```sh
pnpm test:integration
```

Installed workspace dependencies and a running permitted local Docker engine
with Compose are required. No development database, env-file setup, seed or
host PostgreSQL client is needed. The runner uses the same inspected Docker
context/endpoint protections as `pnpm infra`; sandbox-denial guidance above
applies. It refuses exported `DATABASE_URL`, `DATABASE_MIGRATION_URL`,
`TEST_DATABASE_URL` and hosted migration authorization rather than silently
replacing them. Unset conflicting exports explicitly; existing app env files
remain untouched and cannot redirect the runner's child targets.

Each invocation starts only `postgres-test` under a unique `flowmark-test-*`
Compose project. PostgreSQL 18 stores its data in a 512 MiB tmpfs mount at
`/var/lib/postgresql`, publishes an allocated port on `127.0.0.1`, and creates no
data volume. The runner waits for TCP health, correlates labels/container/port
and SQL database/role identity, then supplies the same disposable URL in all
three database variables. It builds API/auth dependencies, applies committed
Drizzle migrations, runs db and server tests directly, and verifies their TAP
and JSON reports. Empty/missing required integration coverage, skips, cancelled
tests and command failures fail the run; integration results never use Turbo's
test cache. HTTP suites create their own synthetic projects and keys with demo
mode off. Development/demo data and migration history are not reused or reset.

Concurrent runs get different databases, ports and storage. Native builds/tests
within the same checkout wait for an owned workspace lock to prevent competing
compiler output; separate worktrees run independently. The wait is bounded at
two minutes and prints the lock path. A busy/stale lock is an explicit error;
inspect its `owner.json` PID and reports before removing a confirmed abandoned
lock. Never delete a running owner's lock.

The printed report directory contains `run.json` (runner PID, project, context,
container and port), redacted `commands.log`, `db.tap` and `server.json` once their steps
run. Failures also save the last 100 PostgreSQL log lines to `postgres.log`;
database assertion failures print a bounded failure excerpt and summary. Ordinary failure and
SIGINT/SIGTERM stop owned native subprocesses, then remove only this run's
containers/network without volume-deletion flags. The original failing status
is preserved; the runner exits 130/143 for SIGINT/SIGTERM. Agents can cancel the
registered runner PID after verifying it still belongs to that active run;
signalling a package-manager wrapper directly can produce its own exit status.
Cleanup failure is explicit and keeps
the run identity for diagnosis. SIGKILL, a stopped engine or a host crash may
leave resources: inspect `run.json`, the recorded context and resource labels
before manually removing exactly those containers/network. Never use global
cleanup, `down -v`, delete volumes, or stop unrelated services.

Direct `pnpm --filter @flowmark/db test` and server test entrypoints validate any
configured `TEST_DATABASE_URL` before fixture writes. They require the runner's
owned tmpfs/container proof or CI's exact service identity; an arbitrary
loopback database is not sufficient. Without `TEST_DATABASE_URL`, normal unit
checks intentionally skip database cases and remain Docker-independent. Use
`pnpm test:integration` to require full database coverage.

The PR workflow retains its separate **PostgreSQL integration tests** job and
empty PostgreSQL 18 Actions service. `pnpm test:integration --ci-service` shares
the build/migrate/db/server/report sequence without launching Compose. That
path requires Actions/CI markers and the declared local `flowmark_ci` role,
`flowmark_test` database and port 5432; it refuses hosted targets and migration
authorization. Both db and server reports must show complete execution. The fast
`pnpm check` job remains independent and receives no database credentials. No
Neon credentials, hosted settings or demo seed are used.

These tests cover ingestion, idempotency, browser quotas, and project isolation.
The authenticated ingestion suite now covers registration → sign-in → project
and key creation → ingestion → persisted-run read with a real Better Auth
session, with demo mode off. It also checks that project headers and management
inputs cannot grant another user's access, that a new project stores one write
key, that write-key rotation commits or rolls back as a whole, and that
signed-out sessions fail.

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

Run `pnpm test:integration`; the result prints a baseline and four post-wave counts. A local
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
- Dashboard asks you to sign in: use `local@flowmark.test` / `local-dev-only` after
  `pnpm db:setup`, or register a new account. Anonymous reads are rejected.
- API returns storage/configuration errors: check `DATABASE_URL`, PostgreSQL
  reachability, and run `pnpm db:setup` against that same database.
- A browser key works only from its configured origin. The local harness allows
  loopback ports 3004 and 5173; a different port requires an explicit allowlist
  change, not a wildcard CORS bypass.
- If port 3000 belongs to another project, use `PORT=3100 pnpm dev:all`. The web app
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
