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
[docs/infrastructure.md](../../../docs/infrastructure.md). This skill is how
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

Always pass `--scope mumma6s-projects` and `--project <name>`. A bare
`vercel` in this repo can attach to the wrong linked project.

## Projects

| Project | Root | Public URL |
| ------- | ---- | ---------- |
| `flowmark-web` | `apps/web` | `https://flowmark.dev` |
| `flowmark-docs` | `apps/docs` | `https://docs.flowmark.dev` |
| `flowmark-dashboard` | `apps/dashboard` | `https://app.flowmark.dev` |
| `flowmark-api` | `apps/server` | `https://api.flowmark.dev` |

`www.flowmark.dev` redirects to the apex. `flowmark-web-delta.vercel.app` is
only the spare hostname. `*.vercel.app` is behind Vercel Authentication.
Custom domains are public.

Do not create a project for `apps/dev-harness` or `apps/internal-docs`.
Ask before creating a project, attaching a domain, or any other paid change.
Do not seed Neon. Preview and Production currently share the production
database.

Each app's `vercel.json` already sets Next.js, function region `fra1`, and
the monorepo install and Turbo build. Node is 22.x. Leave those unless the
infrastructure guide is updated in the same change.

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
puts the secret in the process list. Repeat `--environment` for Production
and Preview. Mark secrets `--sensitive`.

```sh
npx vercel@latest env add <NAME> --sensitive --yes \
  --environment production --environment preview \
  --project <project> --scope mumma6s-projects
```

The command reads stdin when `--value` is omitted. Never echo the value
back. After a change, redeploy the project. The catalog of which variable belongs on which
project is in the infrastructure guide. In particular:

- `BETTER_AUTH_URL` and `FLOWMARK_DASHBOARD_ORIGIN` are
  `https://app.flowmark.dev`, not the API origin.
- `DATABASE_URL` on `flowmark-api` is the pooled Neon URL. The unpooled URL
  is only `DATABASE_MIGRATION_URL` for a workstation `pnpm db:migrate`.
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
