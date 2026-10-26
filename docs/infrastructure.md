# Infrastructure

Operating record for the Flowmark reference deployment. Customer docs do not
include this. The internal docs app renders this file locally and must not be
deployed.

Provider choices are in
[ADR 0006](./decisions/0006-mvp-0.1-infrastructure.md). The remaining rollout
order is in [MVP-INFRA.md](../MVP-INFRA.md) and
[NEXT-PHASE-PLAN.md](../NEXT-PHASE-PLAN.md). This guide records what is
actually provisioned and how to operate it.

Do not put connection strings, role passwords, or API keys in this file, in
chat, or in a commit. Neon connection files are gitignored.

## What exists today

| Piece | State |
| ----- | ----- |
| Neon Postgres | Provisioned. Committed migrations applied. No seed. No demo mode. Empty of product data. |
| Local demo database | Unchanged. `apps/server/.env.local` stays on loopback with `FLOWMARK_DEMO_MODE=true`. |
| Vercel | Four Hobby projects on team `mumma6s-projects`, all connected to `Mumma6/flowmark`. A push to `main` builds each one. |
| Public hostnames | `https://flowmark.dev`, `https://docs.flowmark.dev`, `https://app.flowmark.dev`, and `https://api.flowmark.dev`. `www.flowmark.dev` redirects to the apex. |
| npm packages | Not published. |
| End-to-end hosted use | Not proven. The apps respond. Registering a user, sending telemetry, and opening that run on the hosted dashboard has not been done. |
| 30-day telemetry cleanup | Decided, not built. |
| Backup restore drill | Not done. |

Do not deploy `apps/dev-harness` or `apps/internal-docs`. Do not seed Neon.
Ask before publishing to npm, rotating credentials, or restoring a database.

## Reference deployment

One GitHub repository, four Vercel projects. Each project has its own root
directory and its own environment. They do not share a Vercel env scope.

| Vercel project | Root | Package filter | Public URL |
| -------------- | ---- | -------------- | ---------- |
| `flowmark-web` | `apps/web` | `@flowmark/web` | `https://flowmark.dev` |
| `flowmark-docs` | `apps/docs` | `@flowmark/docs` | `https://docs.flowmark.dev` |
| `flowmark-dashboard` | `apps/dashboard` | `@flowmark/dashboard` | `https://app.flowmark.dev` |
| `flowmark-api` | `apps/server` | `@flowmark/server` | `https://api.flowmark.dev` |

`www.flowmark.dev` is attached to `flowmark-web` and redirects to
`https://flowmark.dev`. The spare hostname `flowmark-web-delta.vercel.app`
exists because `flowmark-web.vercel.app` was already taken. It is not a
product URL. `*.vercel.app` hostnames sit behind Vercel Authentication.
Custom domains are public.

Each app's `vercel.json` sets the framework to Next.js, the function region
to `fra1`, and these commands:

```sh
cd ../.. && pnpm install --frozen-lockfile
cd ../.. && pnpm exec turbo build --filter=@flowmark/<package>
```

The root directory is the app, so the commands walk back to the repository
root. Vercel is allowed to use files outside that root. That is required:
the apps depend on workspace packages. Node.js is 22.x. Functions run in
Frankfurt, next to the Neon region `aws-eu-central-1`. The build itself
still runs in Vercel's default build region.

A push to `main` deploys all four projects. The build uses the commit, not
the local working tree. Preview deployments, when a non-production branch is
built, currently receive the same variable values as production, including
the same database. A preview is not an isolated Neon branch. Do not seed it.

`.vercelignore` is committed. When that file exists, Vercel uses it instead
of `.gitignore` to decide what a deployment upload contains. It excludes
dependencies, build caches, `.turbo`, `.env` files, and `.neon`. Git ignores
those too. Ignore rules are not a substitute for keeping secrets out of the
repository.

```text
Browser
  -> https://app.flowmark.dev/api/auth, /api/register, /api/trpc
  -> dashboard server forwards the cookie to https://api.flowmark.dev
  -> Better Auth and project-scoped reads
  -> Neon Postgres (pooled)

Customer server
  -> https://api.flowmark.dev/v1/events
  -> project write key
  -> Neon Postgres (pooled)
```

Landing and customer docs do not open the database. The API is the only
process that does.

Migrations do not run on a Vercel build or on an incoming request. Apply
them from a workstation with `pnpm db:migrate` and
`DATABASE_MIGRATION_URL`, as described under Neon.

`GET https://api.flowmark.dev/api/health` is a liveness check. It does not
touch the database. Deployment and function logs are on the Vercel project.
Database logs and backups are in the Neon console for project `flowmark`.
Changing an environment variable does not affect a deployment that is
already built. Redeploy after a change. `NEXT_PUBLIC_*` values are inlined
at build time, so they always need a new deployment.

## Environment variables

There are two environments. They use different files, different databases,
and different values. Do not copy one into the other.

| | Local demo | Reference deployment |
| --- | --- | --- |
| Where values live | Gitignored `.env.local` in each app | Vercel project settings, Production and Preview |
| Database | Loopback PostgreSQL in `apps/server/.env.local` | Neon branch `production`, pooled URL, on `flowmark-api` only |
| Demo mode | `FLOWMARK_DEMO_MODE=true` on the API, dashboard, and harness | Unset. The API and dashboard reject it when `NODE_ENV` or `VERCEL_ENV` is `production` |
| Who may read product data | The seeded `local@dev` account and local fixture keys | Accounts created through `https://app.flowmark.dev` |

`pnpm dev:setup` copies the public `.env.example` templates onto missing
`.env.local` files. It never overwrites an existing file and never prints
values. `packages/db/.env.neon` is not one of those templates. Pulling
Vercel env into `apps/server/.env.local` would point the local demo at
Neon. Do not do that.

### How a value reaches the process

Local:

1. A variable already exported in the shell wins. `loadEnvFile` does not
   override it.
2. Next.js dev loads that app's `.env.local`, then `.env`.
3. `pnpm db:migrate`, `pnpm db:setup`, and `pnpm db:seed` load
   `apps/server/.env.local` and `apps/server/.env` only. They do not load
   `packages/db/.env.neon` or the dashboard env file.
4. `pnpm dev` forwards `PORT`, `DATABASE_URL`, `FLOWMARK_*`,
   `NEXT_PUBLIC_*`, and `SUPABASE_*` into Turbo dev tasks. Supabase is not
   part of this deployment. The pass-through is only there so an exported
   value is not stripped.

On Vercel:

1. The project environment is injected for the build and for the running
   function.
2. Turbo 2 removes build environment variables that are not listed on the
   `build` task. `turbo.json` passes through `DATABASE_URL`,
   `DATABASE_MIGRATION_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
   `FLOWMARK_*`, and `NEXT_PUBLIC_*`. A variable missing from that list is
   absent during `turbo build`. Next can then inline it as empty. Add the
   name there before introducing a new build-time variable.
3. `NEXT_PUBLIC_*` is inlined into the client bundle. It is public. Never
   put a database URL, auth secret, or write key in one.
4. Server code reads `process.env` when the function runs. The dashboard
   layouts are `force-dynamic` because they read the session cookie. That
   keeps the build from prerendering a signed-in page. It does not remove
   the need for `FLOWMARK_API_URL` at runtime.

`NODE_ENV` and `VERCEL_ENV` are set by the platform. Do not set them in
`.env.local` or in the Vercel project to change this behavior. A production
build has `NODE_ENV=production`. A production deployment also has
`VERCEL_ENV=production`. Either one is enough for the demo-mode refusal.

### Reference deployment values

Set these on Production and Preview. Leave every other product variable
unset. Values below are origins, not secrets. The pooled database URL and
`BETTER_AUTH_SECRET` are stored in Vercel as sensitive. They are not written
here.

`flowmark-api` (`apps/server`):

| Variable | Value | Read by |
| -------- | ----- | ------- |
| `DATABASE_URL` | Pooled Neon URL from `packages/db/.env.neon` | API runtime and Better Auth. `postgres` is opened with `prepare: false` because this URL uses the transaction pooler. |
| `BETTER_AUTH_SECRET` | Generated secret, API only | Better Auth. Required because demo mode is off. There is no production fallback. |
| `BETTER_AUTH_URL` | `https://app.flowmark.dev` | Better Auth base URL. This is the dashboard origin, because the browser talks to the dashboard and the dashboard proxies auth. It is not `https://api.flowmark.dev`. |
| `FLOWMARK_DASHBOARD_ORIGIN` | `https://app.flowmark.dev` | Trusted origin for auth and the dashboard's cross-origin requests. Same host as `BETTER_AUTH_URL`. |

`flowmark-dashboard` (`apps/dashboard`):

| Variable | Value | Read by |
| -------- | ----- | ------- |
| `FLOWMARK_API_URL` | `https://api.flowmark.dev` | Server-side proxy for `/api/auth/*`, `/api/register`, and `/api/trpc/*`, and the session lookup. No production fallback. |
| `NEXT_PUBLIC_FLOWMARK_DOCS_URL` | `https://docs.flowmark.dev/docs/introduction` | Docs link in the dashboard shell. Public. |

`flowmark-web` (`apps/web`):

| Variable | Value | Read by |
| -------- | ----- | ------- |
| `NEXT_PUBLIC_FLOWMARK_DOCS_URL` | `https://docs.flowmark.dev/docs/introduction` | Landing docs links. Public. |
| `NEXT_PUBLIC_FLOWMARK_APP_URL` | `https://app.flowmark.dev` | Landing dashboard link. Public. |

`flowmark-docs` has no project variables. The docs app does not read the
database or auth settings.

Do not set `FLOWMARK_DEMO_MODE`, `DATABASE_MIGRATION_URL`, or
`FLOWMARK_API_KEY` on any Vercel project. Demo mode is a local fixture
switch. The migration URL is for the workstation command, not the running
API. `FLOWMARK_API_KEY` belongs to a customer's application, not to
Flowmark's own projects. The dashboard does not receive `DATABASE_URL` or
`BETTER_AUTH_SECRET`. Landing and docs do not receive them either.

The empty-project snippet and the API reference page choose localhost or
the public origins from `NODE_ENV`. They do not read `FLOWMARK_API_URL`.
On Vercel, `NODE_ENV` is `production`, so those pages show
`https://api.flowmark.dev`.

### Local demo values

Templates live in `apps/server/.env.example`,
`apps/dashboard/.env.example`, and `apps/dev-harness/.env.example`. The
landing page and customer docs need no local env file. In development their
links fall back to `http://localhost:3002` and `http://localhost:3001`.

`apps/server/.env.local`:

| Variable | Local value |
| -------- | ----------- |
| `DATABASE_URL` | Loopback PostgreSQL, for example the database created for `pnpm db:setup`. Never the Neon URL. |
| `FLOWMARK_DEMO_MODE` | `true` |
| `FLOWMARK_DASHBOARD_ORIGIN` | `http://localhost:3001` |
| `BETTER_AUTH_URL` | `http://localhost:3001` |
| `BETTER_AUTH_SECRET` | Unset. Demo mode uses the development fallback in `packages/db`. Do not copy that fallback to Vercel. |
| `DATABASE_MIGRATION_URL` | Unset, unless a command is deliberately targeting another database. When unset, migrate uses `DATABASE_URL`. |

`apps/dashboard/.env.local`:

| Variable | Local value |
| -------- | ----------- |
| `FLOWMARK_API_URL` | `http://localhost:3003` |
| `FLOWMARK_DEMO_MODE` | `true` |
| `NEXT_PUBLIC_FLOWMARK_DOCS_URL` | Unset. Development uses `http://localhost:3002/docs/introduction`. |

`apps/dev-harness/.env.local`:

| Variable | Local value |
| -------- | ----------- |
| `FLOWMARK_API_KEY` | `fm_demo_write_local_only` |
| `FLOWMARK_API_URL` | Unset. The SDK uses `http://localhost:3003` outside production. |

`FLOWMARK_API_KEY` is read only by the harness server. The harness browser
uses its own public local key in code. Neither key works against the
reference API: demo credentials are rejected unless demo mode is on, and
demo mode is refused in production.

`TEST_DATABASE_URL` is a shell variable for PostgreSQL integration tests.
It is not a Vercel setting and not a `.env.local` requirement.
`FLOWMARK_DOCS_DIST_DIR` only overrides the docs build output directory.

`pnpm db:setup` and `pnpm db:seed` refuse to run unless demo mode is on,
and they refuse a runtime `DATABASE_URL` that is not on loopback.
`db:setup` still migrates `DATABASE_MIGRATION_URL` before it seeds. Do not
run either command while that variable points at Neon. `pnpm db:migrate`
is the command that may target Neon, and only through
`DATABASE_MIGRATION_URL`.

### Customer applications

These variables belong to the application that sends telemetry. They are
not set on the Flowmark Vercel projects.

| Variable | Meaning |
| -------- | ------- |
| `FLOWMARK_API_KEY` | Private project write key. Required. Never `NEXT_PUBLIC_`. |
| `FLOWMARK_API_URL` | API origin. Outside production the SDK falls back to `http://localhost:3003`. In production there is no fallback. The reference origin is `https://api.flowmark.dev`. HTTPS is required except for loopback. |

A browser key is passed in code as `publicKey` plus `apiUrl`. The browser
SDK does not read `FLOWMARK_API_KEY`.

## Neon

### Why this shape

Flowmark needs managed PostgreSQL. It does not need a second application
platform. The reference database is ordinary PostgreSQL through the existing
`postgres` driver and Drizzle.

The client in `packages/db` opens `postgres(connectionString, { prepare: false })`.
That disablement is required for Neon's transaction pooler. Do not switch the
runtime to `@neondatabase/serverless` or `pg` unless a real deployment test
fails on this driver.

These Neon services are off, on purpose:

- Neon Auth. Dashboard sign-in is Better Auth in `apps/server`.
- Object storage, functions, AI gateway, and realtime.

Self-hosters can still use any PostgreSQL. Neon is the reference deployment,
not a dependency of the SDK.

### Project

| Field | Value |
| ----- | ----- |
| Organization | `org-wild-wave-22478289` |
| Project name | `flowmark` |
| Project id | `snowy-dawn-12186433` |
| Region | AWS `eu-central-1` |
| Default branch | `production` (`br-soft-hall-b9oqm03e`) |
| Services | Postgres only |

The `production` branch is the database behind `https://api.flowmark.dev`.
Do not load demo fixtures into it.

### Files

All Neon project files live in `packages/db`, not the repository root.

| Path | Committed | Role |
| ---- | --------- | ---- |
| `packages/db/neon.ts` | Yes | Neon policy. Auth is off. A new non-default branch expires after 7 days. The default branch has no TTL and no other override. |
| `packages/db/.neon` | No | Links this directory to the org, project, and `production` branch. |
| `packages/db/.env.neon` | No | `DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct), and `NEON_BRANCH`. |
| `.agents/skills/neon` and `.agents/skills/neon-postgres` | Yes | Neon agent skills installed for this repository. |
| `skills-lock.json` | Yes | Lockfile for those skills. |

`neon.ts` is not part of the `@flowmark/db` TypeScript program. `tsconfig.json`
includes `src/**/*.ts` only, and lint covers `src`. `@neon/config` and
`@neon/env` are dev dependencies of `@flowmark/db`.

Run Neon CLI commands from `packages/db`. From the repository root the CLI
does not see `.neon` and asks which project to use.

```sh
cd packages/db
npx neon@latest deploy --no-env-pull
npx neon@latest env pull --file .env.neon
```

`neon deploy` applies `neon.ts`. With the current policy that is a no-op on
`production` and only provisions Postgres. `env pull` rewrites
`packages/db/.env.neon`. It does not update `apps/server/.env.local` or the
Vercel project. After a password rotation, pull again and then update the
sensitive `DATABASE_URL` on `flowmark-api` by hand. Redeploy the API after
that update.

The Neon CLI writes quoted values. Node's `loadEnvFile` strips quotes, but
pasting a quoted URL into a shell variable does not. Strip the surrounding
quotes before using a value. Never print the URL.

### Connections

| Variable | Use |
| -------- | --- |
| `DATABASE_URL` in `packages/db/.env.neon` | Pooled runtime URL. This is the value stored on `flowmark-api`. |
| `DATABASE_URL_UNPOOLED` | Direct URL. Use this as `DATABASE_MIGRATION_URL` when applying migrations. It is not a Vercel variable. |
| `DATABASE_URL` in `apps/server/.env.local` | Local loopback only. Leave it there. |

`pnpm db:migrate` loads `apps/server/.env.local` and `apps/server/.env`. It
does not load `packages/db/.env.neon`. `loadEnvFile` does not override
variables that are already set. Migrations use `DATABASE_MIGRATION_URL` when
it is set, otherwise `DATABASE_URL`.

Apply committed migrations to Neon from the repository root without replacing
the local demo URL:

```sh
DATABASE_MIGRATION_URL="$(node --input-type=module -e '
import { readFileSync } from "node:fs";
const line = readFileSync("packages/db/.env.neon", "utf8")
  .split("\n")
  .find((entry) => entry.startsWith("DATABASE_URL_UNPOOLED="));
if (!line) {
  process.stderr.write("DATABASE_URL_UNPOOLED is missing from packages/db/.env.neon\n");
  process.exit(1);
}
const value = line.slice("DATABASE_URL_UNPOOLED=".length).trim().replace(/^"|"$/g, "");
process.stdout.write(value);
')" pnpm db:migrate
```

That command writes the URL only into the child process. Do not echo it.

Do not open Drizzle Studio against Neon while the local demo is the database
you mean to inspect. Studio reads `apps/server/.env.local`. An exported
`DATABASE_URL` overrides that file.

### What was applied

On October 26, 2026 the committed migrations were applied to branch
`production`. No seed ran. Demo mode was not enabled. A pooled connection
could read the schema.

Public tables present after that migration:

- `account`, `session`, `user`, `verification`
- `workspaces`, `projects`, `project_members`
- `project_api_keys`, `project_browser_keys`
- `workflows`, `workflow_runs`, `workflow_events`

The database is empty of product data. The first real rows appear when
someone registers on `https://app.flowmark.dev` or a customer application
sends telemetry to `https://api.flowmark.dev`.

### Keep local and Neon apart

`apps/server/.env.local` stays:

- `FLOWMARK_DEMO_MODE=true`
- `DATABASE_URL` on `127.0.0.1`

`apps/dashboard/.env.local` stays pointed at `http://localhost:3003` with
demo mode on.

The API rejects demo mode when `NODE_ENV` or `VERCEL_ENV` is `production`.
That check is not a reason to put the Neon URL into the local env file.

### Operator follow-ups

Do these before treating the branch as a durable environment:

1. Rotate the Neon role password. The database URL was printed by a failed
   diagnostic during the first migration attempt. After rotation, run
   `npx neon@latest env pull --file .env.neon` from `packages/db`, update
   `DATABASE_URL` on `flowmark-api`, and redeploy that project.
2. `neon init` minted an account-wide Neon API key for the Copilot MCP
   integration, id `3468059`, name
   `neon-cli-mcp-20261026T134521Z-6452`. Revoke it with
   `neon api-keys revoke 3468059` if that access is not wanted. The key can
   reach the whole Neon account, not only this project.
3. Record where Neon keeps backups, restore once into an isolated database,
   and confirm the restore is readable. Migrations stay a controlled
   `pnpm db:migrate` step. They do not run on every application build.
4. Add the 30-day cleanup from ADR 0006 only when that increment starts. The
   period is decided. The job does not exist. Do not delete rows by hand to
   make a check pass.

## Still open

- Prove the hosted path: register on `https://app.flowmark.dev`, send one
  event to `https://api.flowmark.dev`, and open that run while signed in.
- npm publish of `@flowmark/core` and `@flowmark/node`.
- The backup restore drill and the 30-day cleanup above.

Phase 1 in the roadmap is the checklist. Ask before publishing to npm or
running a restore.
