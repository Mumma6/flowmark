# Flowmark - MVP 0.1 handoff

> Snapshot: October 25, 2026. This is a factual starting point for a new
> contributor or agent, not a substitute for inspecting the current code.
> Update or retire this snapshot as the infrastructure work lands.

## 1. Current position

Flowmark has a working local POC of workflow observability and is beginning
MVP 0.1 preparation. The founder has reviewed the run experience and wants to
proceed. The product is not deployed, authenticated for production, or confirmed
published on npm merely because package manifests say `0.1.0`.

The workspace was not a Git repository at handoff. No GitHub repository,
deployment, npm publication, or provider account was created by this preparation.

### Read in this order

1. [AGENTS.md](./AGENTS.md): persistent project rules.
2. [BUSINESS-PLAN.md](./BUSINESS-PLAN.md): product direction and scope.
3. [MVP-INFRA.md](./MVP-INFRA.md): proposed deployment/release increments.
4. [NEXT-PHASE-PLAN.md](./NEXT-PHASE-PLAN.md): implemented work and open validation.
5. [SDK-SEMANTICS.md](./SDK-SEMANTICS.md) and
   [TELEMETRY-INTEROPERABILITY.md](./TELEMETRY-INTEROPERABILITY.md).
6. [README.md](./README.md), [development](./docs/development.md), and
   [architecture](./docs/architecture.md) as needed.

Historical SDK proposals are not necessarily current contracts. Verify public
exports and implementation before adopting a proposed API.

## 2. Working product baseline

- `@flowmark/node` exposes Node, Next.js, browser, and proxy entry points.
  Each `workflow(name, options)` creates a separate run under a stable name.
- The SDK records milestones, measured operations, progress, errors, context,
  explicit associations, and completion results.
- Events flow through `apps/server` -> `packages/api` -> PostgreSQL persistence.
  `packages/core` owns domain/event contracts; `packages/db` owns schema/SQL.
- The dashboard has grouped/searchable workflows, bounded run tables,
  result-first investigation, expandable events, and Context/Related tabs.
- Landing and docs explain instrumentation and investigation; the landing
  headline is a plain H1, not manually split into spans or forced line breaks.
- UI uses the shared shadcn-style `@flowmark/ui` package and Tailwind utilities.
  Dashboard/harness use Tailwind 3; landing/docs use Tailwind 4. Check app versions
  and Base UI state attributes before copying styling.

### Local harness

`apps/dev-harness` is an internal fixture, never a public demo or deployment:

- `invoices.import`: five valid invoices or three imported/two rejected.
- `inventory.sync`: twelve updates or timeout after eight updates.
- `orders.fulfill`: reservation/label success or carrier failure after reservation.
- Business processing is synthetic; telemetry delivery and persistence are real.
- `/diagnostics` exercises SDK behavior in a separate local project so technical
  test names do not pollute the operations dashboard.

The shared scenario runner is useful for repeatable verification, but is not yet
the best example of instrumentation inside a normal application. A real-app
integration remains valuable; do not rebuild the harness merely to prepare infra.

## 3. Important limitations and traps

- Dashboard reads currently use a fixed local read key behind a demo-mode proxy.
  Demo mode off intentionally blocks it. This is not production auth.
- Login/account screens are honest disabled previews. The Supabase browser helper
  is unused scaffolding, not evidence of working authentication.
- Read tables filter/page the latest 100 project runs client-side; this is not
  complete historical pagination.
- Results are shown per run; there is no validated cross-run business aggregate.
- Current results attach to completion, not terminal failure. Do not silently
  alter the SDK/event contract to fix this without a real requirement.
- `error({ handled: true })` does not fail a run. Neither an observed error nor
  an operation failure automatically terminates its parent; `fail()` does.
- Reported progress is absolute, not a delta or heartbeat. Related run metadata
  is explicitly supplied, not automatic distributed tracing.
- SDK run IDs and dashboard internal database UUIDs differ. Harness links filter
  a workflow by SDK ID before opening the corresponding internal run.
- Public local keys are intentional fixtures, gated by demo mode. Never reuse
  them as deployed credentials. Keep private server and public browser keys
  separate; Better Auth sessions do not replace unattended SDK authentication.
- `db:setup-demo` currently combines migrations and local seed provisioning.
  The cleaner commands in the MVP plan are proposals, not existing scripts.

The phase still lacks independent developer/non-technical reader validation,
a modest logs/trace comparison, and a useful validated across-run insight.
Founder enthusiasm is positive feedback, not evidence those steps happened.

## 4. Decisions vs proposals

**Keep:** small scope, application-owned execution, workflow/run abstraction,
Effect-first internals, current SDK surface, PostgreSQL/Drizzle, shared UI,
local-only harness, and custom telemetry model for now.

**Not approved just by being written in the infra plan:**

- Neon versus Supabase as PostgreSQL provider.
- GitHub-only auth versus another Better Auth sign-in option.
- Single owner versus shared access, and public registration policy.
- Browser-ingestion scope for the initial release.
- Retention duration and license selection.

The selected public domain is `flowmark.dev`; the infrastructure plan maps
landing/docs/dashboard/API to it and its subdomains. Registration and deployment
still need verification in the maintainer's account.

The maintainer wants to begin with infrastructure and GitHub preparation.
Do not silently implement all of the MVP plan, migrate auth, or provision paid
services before those choices are confirmed.

## 5. Local commands and verification

Use Node >=20.19 (24 LTS recommended) and the pinned pnpm 10.18.1.

```sh
pnpm install
pnpm dev:setup
# Configure a dedicated local PostgreSQL DATABASE_URL in apps/server/.env.local.
pnpm db:setup-demo
pnpm dev
```

`dev:setup` currently prepares missing local env templates, not PostgreSQL.
`db:setup-demo` applies migrations and seeds local configuration. Do not run
either against production. Do not overwrite existing env files.

Typical app ports:

| App           | Port                |
| ------------- | ------------------- |
| Landing       | 3000                |
| Dashboard     | 3001                |
| Customer docs | 3002                |
| API           | 3003                |
| Local harness | 3004, loopback-only |
| Internal docs | 3005, loopback-only |

Existing services may still be running. Check before launching duplicates.

Examples of focused validation:

```sh
pnpm --filter @flowmark/dev-harness test
pnpm --filter @flowmark/dashboard test
pnpm --filter @flowmark/node test
pnpm --filter @flowmark/api test
pnpm --filter @flowmark/dashboard typecheck
pnpm --filter @flowmark/dashboard lint
pnpm --filter @flowmark/dashboard build
```

Use relevant selectors for targeted work rather than running every command.
Repository-wide scripts include `pnpm test`, `pnpm typecheck`, `pnpm lint`,
and `pnpm build`.

**Previously reported checks, not rerun as part of this handoff:** harness
12 tests, dashboard 14, targeted API 15, landing 9, docs 5; affected package
lint/types and dashboard/harness/landing builds passed. Browser verification
covered actual persisted outcomes, timeline expansion, navigation, and responsive
layouts. These are historical results, not a claim the full suite passes today.

The local operations telemetry was explicitly cleaned and regenerated through the
harness, not direct fake-event inserts. Do not reset it automatically. Its precise
run count is intentionally not a stable test assertion.

## 6. Cursor setup

Open the repository root, not an individual app. Project rules are in root
`AGENTS.md`; app-level `AGENTS.md` files contain installed Next.js guidance.

Portable skills live in:

- [.agents/skills/flowmark-architecture/SKILL.md](./.agents/skills/flowmark-architecture/SKILL.md)
- [.agents/skills/flowmark-ui-components/SKILL.md](./.agents/skills/flowmark-ui-components/SKILL.md)

Current Cursor documentation supports `AGENTS.md` and `.agents/skills/`.
Verify that both skills appear in the installed Cursor version. If discovery
does not work, explicitly attach the skill files; root instructions also direct
the agent to read them. Do not maintain divergent Cursor/Copilot copies.

There is no need to transfer editor accounts, private chat history, personal
agent settings, or MCP credentials. Configure tools under the maintainer's
personal account only when needed; this repository contains the durable context.

## 7. First GitHub preparation

The ignore file excludes env files except `.env.example`, build/dependency
artifacts, local Vercel metadata, common private-key files, package tarballs,
and named dump/backup directories. Ignore rules are protection, not a secret
audit; arbitrary filenames and hard-coded secrets can still be committed.

Before the first commit:

1. Confirm this is personal code and no employer-owned material/account config
   is being transferred. Choose the intended personal Git identity.
2. Review templates, npm configuration, editor configuration, and any dumps or
   exports. Do not print secret values into chat/logs.
3. Confirm the license. Existing MIT manifest fields are not a repository license.
4. After explicit approval to initialize Git, inspect `git status --short
--untracked-files=all` and the exact staged diff; do not blindly stage everything.
5. Run an appropriate secret check before publishing. Ignore rules do not remove
   files already tracked in Git.
6. Create/push to the intended GitHub account only with explicit approval.

No full secret scan or publication approval is implied by this handoff.

## 8. Suggested first message in Cursor

```text
Read AGENTS.md and HANDOFF.md, then BUSINESS-PLAN.md, MVP-INFRA.md and the
current status in NEXT-PHASE-PLAN.md. Inspect actual code where necessary.

We are preparing Flowmark MVP 0.1, not building a public multi-tenant SaaS.
Start with GitHub/repository readiness: inspect ignore rules, package metadata,
license status and existing tooling. Do not expose secrets or upload anything.
Summarize what is ready, what needs a decision, and the smallest next increment.
Do not initialize/push a repository, deploy, publish packages, reset data,
or start an auth/database migration without my explicit approval.

Infrastructure provider, auth-provider and ownership decisions in MVP-INFRA.md
are recommendations, not already accepted decisions.
```
