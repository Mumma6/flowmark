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
| Neon Postgres | Provisioned. Committed migrations applied. No seed. No demo mode. |
| Local demo database | Unchanged. `apps/server/.env.local` stays on loopback with `FLOWMARK_DEMO_MODE=true`. |
| Vercel | Not created. There is no hosted API or dashboard. |
| `flowmark.dev` and subdomains | Owned, not attached. |
| npm packages | Not published. |
| 30-day telemetry cleanup | Decided, not built. |
| Backup restore drill | Not done. |

The next infrastructure task is an isolated Vercel preview of `apps/server`
and `apps/dashboard` only. Ask before creating that project, attaching the
domain, or publishing to npm.

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

The `production` branch is the reference database. It is not a public
application environment until the API is deployed in front of it. Do not
load demo fixtures into it.

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
`packages/db/.env.neon`. It does not update `apps/server/.env.local`.

The Neon CLI writes quoted values. Node's `loadEnvFile` strips quotes, but
pasting a quoted URL into a shell variable does not. Strip the surrounding
quotes before using a value. Never print the URL.

### Connections

| Variable | Use |
| -------- | --- |
| `DATABASE_URL` in `packages/db/.env.neon` | Pooled runtime URL. This is what the API should use once it is deployed. |
| `DATABASE_URL_UNPOOLED` | Direct URL. Use this as `DATABASE_MIGRATION_URL` when applying migrations. |
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

`pnpm db:setup` and `pnpm db:seed` are local demo commands. They refuse to run
unless `FLOWMARK_DEMO_MODE=true`, and they refuse a runtime `DATABASE_URL`
that is not on loopback. `db:setup` still applies migrations through
`DATABASE_MIGRATION_URL` before it seeds. Do not run either command while
`DATABASE_MIGRATION_URL` points at Neon. `pnpm db:migrate` is the command that
may target Neon, and only through `DATABASE_MIGRATION_URL`.

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

The database is empty of product data. Registering a user, sending telemetry,
and opening a run still require the hosted API. Those paths are not deployed.

### Keep local and Neon apart

`apps/server/.env.local` stays:

- `FLOWMARK_DEMO_MODE=true`
- `DATABASE_URL` on `127.0.0.1`

`apps/dashboard/.env.local` stays pointed at `http://localhost:3003` with demo
mode on. The hosted dashboard, when it exists, gets its own Vercel
environment. It must not receive `FLOWMARK_DEMO_MODE`.

The API already rejects demo mode when `NODE_ENV` or `VERCEL_ENV` is
`production`. That check is not a reason to put the Neon URL into the local
env file.

### Operator follow-ups

Do these before treating the branch as a durable environment:

1. Rotate the Neon role password. The database URL was printed by a failed
   diagnostic during the first migration attempt. After rotation, run
   `npx neon@latest env pull --file .env.neon` from `packages/db`.
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

## Still ahead

These chapters are not written as operating steps because the resources do
not exist yet. The checklists are the source of truth:

- Vercel preview for `apps/server` and `apps/dashboard`, including
  `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and
  `FLOWMARK_DASHBOARD_ORIGIN`. Landing and customer docs deploy without
  database or auth secrets. Do not deploy `apps/dev-harness` or
  `apps/internal-docs`.
- Domains from ADR 0006: `flowmark.dev`, `docs.flowmark.dev`,
  `app.flowmark.dev`, and `api.flowmark.dev`. Attach them after the preview
  path works.
- npm publish of `@flowmark/core` and `@flowmark/node`.
- Structured API errors, `/api/health`, and a written place to read Vercel
  and Neon logs.

Phase 1 in the roadmap is the checklist. Ask before creating the Vercel
project, attaching the domain, or publishing.
