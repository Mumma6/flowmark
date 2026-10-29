---
name: flowmark-vercel
description: >-
  Operate Flowmark's Vercel projects with the Vercel CLI. Use when deploying,
  checking a build, changing hosted environment variables, connecting GitHub,
  or touching flowmark.dev, app.flowmark.dev, api.flowmark.dev, or
  docs.flowmark.dev. There is no Vercel MCP server.
---

# Flowmark Vercel

Flowmark's reference deployment is four Vercel projects. The provisioned
state and the environment catalog are in
[private/docs/infrastructure.md](../../../private/docs/infrastructure.md). This skill is how
to operate them. Read that guide before changing a project, a domain, or a
variable.

There is no Vercel connector in the agent tool list. Use the Vercel CLI.

## CLI

The logged-in account is `mumma6`. The team scope is `mumma6s-projects`.
Pass both on every command. Run from the repository root.

```sh
npx vercel@latest whoami
npx vercel@latest list <project> --scope mumma6s-projects
```

If `whoami` is logged out, run `npx vercel@latest login` and let the user
complete the device prompt. Do not invent a token, and do not pass
`--token`.

Do not add `vercel` as a repository dependency. Do not run `vercel env pull`
into `apps/server/.env.local`, `apps/dashboard/.env.local`, or any other
local env file. That would point the local demo at Neon. Do not print
connection strings, secrets, or command lines that contain them.

Always select the project explicitly and pass `--scope mumma6s-projects`.
For `list`, pass the project name as the positional argument; CLI 65.7.0
rejects `list --project`. For other commands use `--project <name>` when
supported. A bare `vercel` in this repo can attach to the wrong linked project.

## Projects

| Project              | Root             | Public URL                  |
| -------------------- | ---------------- | --------------------------- |
| `flowmark-web`       | `apps/web`       | `https://flowmark.dev`      |
| `flowmark-docs`      | `apps/docs`      | `https://docs.flowmark.dev` |
| `flowmark-dashboard` | `apps/dashboard` | `https://app.flowmark.dev`  |
| `flowmark-api`       | `apps/server`    | `https://api.flowmark.dev`  |

`www.flowmark.dev` redirects to the apex. `flowmark-web-delta.vercel.app` is
only the spare hostname. `*.vercel.app` is behind Vercel Authentication.
Custom domains are public.

Do not create a project for `apps/dev-harness` or `apps/internal-docs`.
Ask before creating a project, attaching a domain, or any other paid change.
Do not seed Neon. Preview must not use the production database. Repository
guards reject production hosts when `VERCEL_ENV` is `preview`. Keep
Production and Preview on separate Vercel env records. Do not add one env record with both targets for `DATABASE_URL`,
`BETTER_AUTH_URL`, `FLOWMARK_DASHBOARD_ORIGIN`, `BETTER_AUTH_SECRET`, or
dashboard `FLOWMARK_API_URL`.

Each app's `vercel.json` already sets Next.js, function region `fra1`, and
the monorepo install and Turbo build. Node is 22.x. Leave those unless the
infrastructure guide is updated in the same change.

Each app also sets `ignoreCommand` to `scripts/vercel-should-deploy.mjs`,
which runs Turbo's affected check for that workspace. Unchanged apps skip
Preview and Production builds for that commit. Shared dependency changes
(for example `packages/ui`) still rebuild every consumer.

## Deploy

A push to `main` builds all four projects from that commit. Uncommitted
files are not in a Git build. Prefer that path once the change is committed.

Use a CLI production deploy only when the user has asked to deploy the
working tree before it is pushed:

```sh
npx vercel@latest deploy --prod --yes --logs --project <project> --scope mumma6s-projects
```

`.vercelignore` is committed. While it exists, Vercel uses it instead of
`.gitignore` for the upload. It must keep excluding `.env`, `.env.*`,
`.neon`, and `.turbo`.

Check the newest row:

```sh
npx vercel@latest list <project> --scope mumma6s-projects
```

`Ready` is success. `Error` means read that deployment's build log before
deploying again. `Building` and `Queued` are still running.

Turbo drops build environment variables that are not listed in
`turbo.json` `build.passThroughEnv`. A missing name is empty during
`next build`, and Next can inline it that way. `NEXT_PUBLIC_*` is inlined.
Changing one requires a new deployment. The dashboard layouts are
`force-dynamic` because they read cookies. Do not catch Next's dynamic
bailout inside `Effect.tryPromise`.

## Environment variables

List names, not values:

```sh
npx vercel@latest env list --project <project> --scope mumma6s-projects
```

Add a variable by piping the value on stdin. Do not use `--value`. That
puts the secret in the process list. Add Production and Preview as separate
commands so they do not share one value. Mark secrets `--sensitive`.

```sh
npx vercel@latest env add <NAME> --sensitive --yes \
  --environment production \
  --project <project> --scope mumma6s-projects
```

The command reads stdin when `--value` is omitted. Never echo the value
back. After a change, redeploy the project. The catalog of which variable belongs on which
project is in the infrastructure guide. In particular:

- Production `BETTER_AUTH_URL` and `FLOWMARK_DASHBOARD_ORIGIN` are
  `https://app.flowmark.dev`, not the API origin. Preview must not use that
  host. See the infrastructure guide before setting Preview.
- Production `DATABASE_URL` on `flowmark-api` is the pooled Neon URL for
  branch `production`. Preview uses the pooled URL for branch `preview` and
  `FLOWMARK_DATABASE_BRANCH=preview`. Preview `FLOWMARK_API_URL` must be that
  branch's preview API deployment. `flowmark-api-mumma6s-projects.vercel.app`
  is the production deployment alias and still reads the production database.
  The unpooled URL is only
  `DATABASE_MIGRATION_URL` for a workstation `pnpm db:migrate:prod`,
  `pnpm db:migrate:preview`, or `pnpm db:migrate:staging`. It is not a
  Vercel variable.
- Staging is the git branch `staging` on these same projects, not a new
  project and not a shared Preview value. Its database, auth, and
  `FLOWMARK_API_URL` records are Preview variables scoped to that git
  branch. The dashboard origin is `https://app.staging.flowmark.dev` and
  the API origin is `https://api.staging.flowmark.dev`. Do not point those
  at `*.vercel.app`. Standard Protection still covers a custom domain on a
  non-production git branch, so those two hostnames are Deployment
  Protection Exceptions. Do not add that exception to a `*.vercel.app`
  alias. See the infrastructure guide before changing the records.
- Do not set `FLOWMARK_DEMO_MODE`, `DATABASE_MIGRATION_URL`, or
  `FLOWMARK_API_KEY` on Vercel.

## GitHub

The projects are connected to `https://github.com/Mumma6/flowmark`. Branch
`main` is production. Connect a project only if it is disconnected:

```sh
npx vercel@latest git connect https://github.com/Mumma6/flowmark.git --yes \
  --scope mumma6s-projects --project <project>
```

If the CLI says the repository cannot be accessed, stop. The user grants
the Vercel GitHub App on that repo at
`https://github.com/settings/installations`. Do not retry until they say
the access is granted.
