# Flowmark agent guidelines

## Start here

- Product direction, roadmap, and infrastructure operating notes live in the
  local-only `private/` folder (`PRODUCT-VISION.md`, `NEXT-PHASE-PLAN.md`,
  `MVP-INFRA.md`, `docs/infrastructure.md`). That folder is listed in
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
- Flowmark is a focused open-source workflow observability product. Ambition
  inside that domain is welcome. It is not an enterprise observability
  platform or a public multi-tenant SaaS. Prefer the local product vision
  before expanding scope.
- Business results are application-reported evidence, not verified correctness.
  Completed does not mean every record succeeded. Progress is last reported;
  missing terminal telemetry does not prove a run is active or failed.
- `apps/dev-harness` and `apps/internal-docs` are local-only. Never deploy them.
- Discuss fundamental SDK/model redesign, new major dependencies, telemetry
  migrations, and significant product-scope changes before implementing.

## Architecture and UI

- Before TypeScript, Effect, SDK, API, core, or persistence changes, read and
  apply
  [flowmark-effect](./.agents/skills/flowmark-effect/SKILL.md) and
  [flowmark-architecture](./.agents/skills/flowmark-architecture/SKILL.md).
  Use modern Effect as the default (pipe, Match, Result.match, catchTags,
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
- Use Tailwind utilities and shared semantic theme tokens. No app-specific CSS
  classes, CSS modules, or inline styling for normal layouts. Theme variables
  and Tailwind directives belong in global CSS.
- Preserve accessible interaction, responsive layouts, and real loading/error/
  empty states. English product UI/docs; respond to the maintainer in Swedish.

## Working practices

- Start each normal PR from the latest `origin/staging` on its own
  `codex/` feature branch, and explicitly target `staging` when opening it.
  Release PRs retain the documented `staging` to `main` workflow.
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
