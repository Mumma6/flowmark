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
dependency with `pnpm --filter @flowmark/node... build`. Do not launch a direct
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
`pnpm db:seed` at that project.

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

API unit tests run without PostgreSQL using injected authorization/repository
services. They cover lazy ingestion, Schema validation, project scoping, typed
failures, redacted settings, and scoped connection cleanup on success, failure,
and interruption. Run them with `pnpm --filter @flowmark/api test`; database
integration coverage additionally needs `TEST_DATABASE_URL` as described below.

## Environment and database

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

Database integration tests use an explicitly selected test database after the
same migration/demo setup:

```sh
TEST_DATABASE_URL=postgresql://localhost:5432/flowmark_test \
  pnpm --filter @flowmark/api test
```

Without `TEST_DATABASE_URL`, the PostgreSQL integration tests are skipped.
They create isolated test projects and verify ingestion, idempotency, metrics,
failed runs, and cross-project read isolation.

## Troubleshooting local data

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

## SDK publishing

`packages/sdk` is independently package-shaped as `@flowmark/node`; it is not published by this repository setup. Add Changesets when release/version coordination becomes useful rather than introducing release automation now.
