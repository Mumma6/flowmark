# Flowmark agent guidelines

## Start here

- Read [the handoff](./HANDOFF.md) for the current baseline and next task.
- Product direction: [BUSINESS-PLAN.md](./BUSINESS-PLAN.md) and
  [NORTH-STAR.md](./NORTH-STAR.md).
- Phase status: [NEXT-PHASE-PLAN.md](./NEXT-PHASE-PLAN.md).
- MVP infrastructure proposals: [MVP-INFRA.md](./MVP-INFRA.md). Recommendations
  there are not automatically approved implementation decisions.
- Read applicable nested `AGENTS.md` files. Next.js apps require checking the
  installed Next.js documentation before framework changes.

## Product boundaries

- Flowmark observes application-owned work; it never executes, schedules, or
  retries that work. Preserve the workflow/run abstraction.
- This is a small open-source developer tool, not an enterprise observability
  platform or a public multi-tenant SaaS.
- Business results are application-reported evidence, not verified correctness.
  Completed does not mean every record succeeded. Progress is last reported;
  missing terminal telemetry does not prove a run is active or failed.
- `apps/dev-harness` and `apps/internal-docs` are local-only. Never deploy them.
- Discuss fundamental SDK/model redesign, new major dependencies, telemetry
  migrations, and significant product-scope changes before implementing.

## Architecture and UI

- Before SDK/API/core/persistence changes, read and apply
  [flowmark-architecture](./.agents/skills/flowmark-architecture/SKILL.md).
  Use Effect-first functional internals, typed errors, small ports/adapters,
  and an ordinary ergonomic TypeScript/Promise SDK boundary.
- Keep API use cases in `packages/api`; `apps/server` is the framework/protocol
  shell. Keep database-specific work behind persistence boundaries.
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
