# Flowmark agent guidelines

## Start here

- Product direction, roadmap, and infrastructure operating notes live in the
  local-only `private/` folder. `PRODUCT-VISION.md` is the authoritative
  Product 1.0 direction; `plans/product-1-0/{SPEC,ROADMAP,BRAND}.md` own the
  experience, delivery plan and messaging. `INFRASTRUCTURE-ROADMAP.md` and
  `docs/infrastructure.md` retain operational ownership. That folder is listed in
  `.gitignore` and is not in the public Git tree. Confirmed provider
  and auth choices are in
  [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md). Neon and the
  four Vercel projects exist. Local demo stays on loopback. Do not seed Neon.
  npm publish, backup restore, and retention cleanup are not automatically
  approved.
- Read applicable nested `AGENTS.md` files. Next.js apps require checking the
  installed Next.js documentation before framework changes.

## Product boundaries

- Flowmark observes application-owned work; it never executes, schedules, or
  retries that work. Preserve the workflow/run abstraction.
- Flowmark Product 1.0 is an open-source, programmable process-intelligence
  platform for people and AI agents. Platform, Studio and Everywhere are
  dimensions of one product. Serve organization-wide questions over shared
  authorized evidence; preserve workflow/run semantics. Follow the local vision
  rather than retired MVP scope limits. This direction does not authorize
  enterprise identity/billing, an execution engine or hosted operations.
- Business results are application-reported evidence, not verified correctness.
  Completed does not mean every record succeeded. Progress is last reported;
  missing terminal telemetry does not prove a run is active or failed.
- `apps/dev-harness` and `apps/internal-docs` are local-only. Never deploy them.
- Discuss fundamental SDK/model redesign, new major dependencies, telemetry
  migrations, and significant product-scope changes before implementing.

## Infrastructure ownership

- Before any infrastructure or persistent hosted configuration change, read and
  apply [flowmark-infrastructure](./.agents/skills/flowmark-infrastructure/SKILL.md).
  Use the existing `infrastructure/` Pulumi project for all providers, resources,
  hosted secrets, domains/DNS and CI configuration. Declare/import first, review
  the exact preview, then apply only the approved plan.
- Centralize hosted app/CI env definitions in Pulumi: one logical input per
  environment, reused/derived into Vercel and GitHub bindings. Keep secrets in
  encrypted Pulumi config or references to an approved central store. Provider
  settings and app env files are not parallel sources. New required hosted vars
  need a Pulumi binding and environment-catalog entry before rollout.
- Do not mutate infrastructure through a provider CLI, connector, dashboard,
  `pulumi do` or `neon.ts` and reconcile it afterward. Those tools may inspect
  resources and run the separately documented operational workflows. A missing
  provider feature or currently external property needs reviewed Pulumi support/
  adoption before mutation, not an imperative fallback. The
  [writer policy](./docs/infrastructure.md#pulumi-is-the-infrastructure-writer)
  defines the boundary with app deployments, Drizzle, data and publication.

## Architecture and UI

- For every feature or meaningful refactor involving computation, analysis or
  data processing, apply
  [flowmark-architecture](./.agents/skills/flowmark-architecture/SKILL.md) to
  consider TypeScript/Effect, PostgreSQL and Rust ownership. Rust is a permanent
  architectural option; additional functionality and crates are welcome when
  justified. Before Rust or WASM changes, also apply
  [flowmark-rust](./.agents/skills/flowmark-rust/SKILL.md).
- Before TypeScript, Effect, SDK, API, auth, core, or persistence changes, read and
  apply
  [flowmark-effect](./.agents/skills/flowmark-effect/SKILL.md) and
  [flowmark-architecture](./.agents/skills/flowmark-architecture/SKILL.md).
  Use modern Effect as the TypeScript default (pipe, Match, Result.match, catchTags,
  Layers, Scope, services). Keep typed errors, small ports/adapters, and an
  ordinary TypeScript/Promise SDK boundary.
- Before `@flowmark/db`, Drizzle, SQL, query, migration, or seed changes, read
  and apply
  [flowmark-persistence](./.agents/skills/flowmark-persistence/SKILL.md).
- Include schema, generated SQL/Drizzle metadata and affected stack changes in
  the same PR. Follow [database rollout](./docs/migrations.md): local/CI checks,
  Preview verification, then the activated merge pipeline checks/migrates/deploys
  Staging after feature merge and Production after release merge. Track implementation completion separately
  from environment rollout; Production is not a feature PR completion gate.
  Use guarded commands or the approved migration workflow. Never seed Neon,
  edit applied migrations or bypass Drizzle history. Hosted mutation still
  requires approval for the exact environment and reviewed revision. After
  deliberate pipeline activation, approval to merge the documented schema change
  authorizes that branch rollout; do not ask again for the same operation.
- Keep API use cases in `packages/api`; `apps/server` is the framework/protocol
  shell. Keep database-specific work behind persistence boundaries.
  User sessions, the auth factory, signed proxy identity, and local account
  provisioning live in private `@flowmark/auth`. That package may depend on
  `@flowmark/db`; the database package must not depend on it. Project
  authorization and ingestion keys stay in `@flowmark/api`.
- Before Vercel, domain, or hosted environment changes, read and apply
  [flowmark-vercel](./.agents/skills/flowmark-vercel/SKILL.md). The detailed
  operating record is maintainer-local (`private/docs/infrastructure.md`).
- Before publishing `@flowmarkdev/core` or `@flowmarkdev/node`, read and
  apply [flowmark-npm](./.agents/skills/flowmark-npm/SKILL.md). Ask before
  every publish.
- Before frontend changes, read and apply
  [flowmark-ui-components](./.agents/skills/flowmark-ui-components/SKILL.md).
  Use shadcn components through `@flowmark/ui`; add missing reusable primitives
  there, not as app-local copies.
- Before reviewing one package, app, or directory for architecture, standards,
  Effect usage, file organization, or simplification, read and apply
  [architecture-review](./.agents/skills/architecture-review/SKILL.md).
  A review is read-only. Refactor only when the user explicitly asks to
  implement an approved finding or a named scope.
- Use Tailwind utilities and shared semantic theme tokens. No app-specific CSS
  classes, CSS modules, or inline styling for normal layouts. Theme variables
  and Tailwind directives belong in global CSS.
- Preserve accessible interaction, responsive layouts, and real loading/error/
  empty states. English product UI/docs; use the maintainer's requested response language.

## Working practices

- Docker Compose is the only local infrastructure provider. Use `pnpm dev:setup`,
  `pnpm infra doctor`, `pnpm infra up`, then `pnpm db:setup` once. Existing env
  files/data are preserved; incompatible old configuration must be deliberately
  changed to the Compose template. Never fall back to unmanaged PostgreSQL or a
  hosted database. See [local infrastructure](./docs/development.md#local-postgresql-with-compose)
  and the [command inventory](./docs/development-commands.md).
- Use `pnpm dev` for API, dashboard, harness, both documentation apps and
  native library watchers; append `--ui=stream` for non-interactive logs.
  `pnpm dev:all` also includes web when PostgreSQL is already healthy. `pnpm dev:stack`
  runs `infra up`, then every application and Drizzle Studio; record its
  `container` and `startedByThisCall`. `pnpm db:studio` starts Studio alone.
  None of these commands migrate or seed on startup.
  One session owns each checkout's build outputs: inspect existing processes/
  ports first, reuse existing services, and never run direct builds/checks/
  integration commands alongside watchers. Use another worktree when somebody
  else owns that session. Stop only processes you started.
- Inspect `pnpm infra status` before starting/stopping anything. `infra up`
  reports the checkout-scoped container ID and `startedByThisCall`. Agents may
  stop only a service they started, using `pnpm infra down --container <id>`;
  leave previously running services alone. A restart needs ownership or an
  explicit user request for that service. `infra down` is a scoped stop and
  retains the container/volume. Never run `down -v`, delete volumes, or prune
  without explicit approval. A reset confirmation flag is not user approval.
- Keep the selected Docker context and security controls unchanged. If socket
  access is sandbox-blocked, record it. For an authorized local task, a narrowly
  scoped request through the normal tool approval mechanism may permit Docker
  verification; this is separate from changing socket permissions or bypassing
  controls. If access is unavailable/rejected, use simulated command tests and
  leave live checks pending. Never substitute a hosted database. Local infra
  commands do not migrate, seed, or reset data.
- Run `pnpm test:integration` for database/server integration coverage. It owns
  a unique temporary PostgreSQL Compose project, allocated loopback port and
  tmpfs storage, then removes only that run's containers/network on success,
  failure or normal interruption. It never deletes volumes or uses demo data.
  Leave exported database URLs/hosted approval variables unset; the runner
  supplies all child targets. Direct package tests reject configured targets
  without managed disposable-test provenance; unset `TEST_DATABASE_URL` keeps
  unit-only checks usable without Docker. Reports and run ownership are printed
  before startup. Inspect these after forced termination; never clean another
  run or delete an active native build/test lock. See
  [integration tests](./docs/development.md#database-integration-tests).

- Before starting implementation on a new task, read and apply
  [branch](./.agents/skills/branch/SKILL.md) to create or verify a
  task-specific branch from the latest `origin/staging`. Open normal PRs
  targeting `staging`; release PRs retain the documented `staging` to `main`
  workflow.
- Inspect existing code and prior art before editing. Prefer the simplest
  complete fix, not new abstractions or unrelated cleanup.
- Preserve existing work; do not overwrite or revert changes you did not make.
- Keep validation at trust boundaries, errors explicit, and project scoping
  enforced. Never turn a failed operation into a success-shaped fallback.
- Keep private server keys out of browser bundles. Browser telemetry is untrusted.
- Update directly related docs. Use the narrowest relevant tests, typecheck,
  lint, and build; inspect UI in a browser when available.
- See [README.md](./README.md) and [development guide](./docs/development.md)
  for existing commands. Use pinned pnpm; do not add tools just to run checks.
- Ask before destructive DB actions, publishing, deploying, or uploading code.
  Never commit env files, secrets, database dumps, or local account configuration.
- Do not assume services are yours to restart or stop; verify existing processes
  and ports first. Do not reset local telemetry to make a test pass.
