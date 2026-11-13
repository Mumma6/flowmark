---
name: architecture-review
description: >-
  Review one selected Flowmark package, app, or directory against repository
  architecture, Effect, persistence, and UI standards. Use when the user asks
  for an architecture review, standards check, consistency review, duplication
  or simplification review, file-organization review, or Effect usage review
  of packages/api, packages/db, packages/sdk, packages/core, apps/server,
  apps/dashboard, apps/web, packages/ui, or another explicit path. Review is
  read-only. Refactor only when the user explicitly asks to implement an
  approved finding or a named scope.
---

# Architecture review

Review one selected target against Flowmark's written standards. This skill
judges implementations. It does not redefine them.

Standards live in the skills and docs below. Load those files and apply them.
Do not paste their rules into the report as if this skill owned them.

Repeated code shows local habit. It becomes a standard only when a skill, ADR,
or architecture doc requires it. A repeated accident is still an accident.

## Modes

Default is **review**: read, compare, and report. Do not create, edit, or
delete files. Do not format, commit, or open a pull request.

These words are review, not implementation: review, check, analyze, inspect,
audit, assess, look at.

**Refactor** runs only when the user explicitly asks to implement, apply, or
fix approved findings, or names a specific refactoring. Never treat a review
request as that permission. Never implement every finding from a review.

If refactor is requested but no approved finding or concrete scope exists,
stop and ask for one. Do not choose the scope yourself.

## Scope

Operate on one directory, package, or app the user names. If they do not name
a target, ask for one. Do not audit the monorepo.

Inspect callers and dependencies only far enough to understand the target.
Do not review those callers unless the user adds them.

The user may narrow the lens:

| Request                        | Review only                                      |
| ------------------------------ | ------------------------------------------------ |
| General architecture review    | All lenses that apply to the target              |
| Standards compliance           | Documented rules and confirmed violations        |
| Duplication and simplification | Real repeated logic and simpler existing shapes  |
| File organization              | Naming, cohesion, placement, and discoverability |
| Effect usage                   | Effect v4 style where Effect already belongs     |
| One named concern              | That concern, plus violations it exposes         |

A clean report with a few evidenced findings is the goal. No findings is a
valid result. Say so.

## Standards to load

Read the matching rows before judging. Skip rules that do not apply to the
target. Do not apply backend structure to React components, or UI rules to
Effect services.

| Target                                                                       | Load                                                                                                                                                                      | Leave out                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/api`                                                               | [architecture](../flowmark-architecture/SKILL.md), [effect](../flowmark-effect/SKILL.md), [architecture doc](../../../docs/architecture.md) API section                   | UI kit rules; db folder layout inside use cases            |
| `packages/db`                                                                | [persistence](../flowmark-persistence/SKILL.md), architecture persistence rules, effect, [migrations](../../../docs/migrations.md) when schema or SQL history is in scope | Ports inside `packages/db`; UI rules                       |
| `packages/sdk`                                                               | Architecture SDK rules, effect, architecture doc SDK section, [ADR 0005](../../../docs/decisions/0005-sdk-does-not-control-application-flow.md)                           | `features/` layout; SQL layout; UI rules                   |
| `packages/core`                                                              | Architecture core rules, architecture doc core section. Effect only where the package already uses it                                                                     | Required ports, layers, or services for pure functions     |
| `apps/server`                                                                | Architecture server-shell rules, effect at the protocol boundary, [apps/server/AGENTS.md](../../../apps/server/AGENTS.md)                                                 | Feature use cases living in route files; db SQL in the app |
| `apps/dashboard`, `apps/web`, `apps/docs`, `apps/dev-harness`, `packages/ui` | [UI components](../flowmark-ui-components/SKILL.md), [design system](../../../docs/design-system.md), the app's `AGENTS.md` when present                                  | Ports, layers, and persistence layout                      |
| `infrastructure/`                                                            | [infrastructure](../flowmark-infrastructure/SKILL.md)                                                                                                                     | Application Effect layers around Pulumi                    |
| Any other path                                                               | Root [AGENTS.md](../../../AGENTS.md), the nearest nested `AGENTS.md`, and the skill for the code you actually find                                                        | Rules for a layer that is not present                      |

For `crates/*`, apply [Rust](../flowmark-rust/SKILL.md), architecture owner selection
and the crate's tests. For `packages/evidence-engine`, also apply Effect to its
TypeScript adapter. Do not impose Effect syntax inside Rust, require a performance
bottleneck to justify Rust, or treat the first engine as its permanent scope.

Also load [effect v4 migration](../../../docs/effect-v4-migration.md) when the
target still uses v3 Effect APIs (`Effect.Service`, `Context.Tag`, `.Default`).

Product boundaries in root `AGENTS.md` apply when the target interprets runs,
results, progress, or browser telemetry. Completed is not business success.
The SDK observes application work and does not execute it. Browser telemetry
is untrusted. `apps/dev-harness` and `apps/internal-docs` stay local-only.

Dashboard and dev-harness use Tailwind 3. Web and docs use Tailwind 4. Do not
treat that split as drift.

Intentional layout differences to keep:

- API features use `features/<domain>/{use-cases,ports,adapters}`.
- SDK domains live under `src/workflows/` and `src/delivery/`, with no
  `features/` prefix. `src/index.ts` is the only source-root file.
- Persistence uses `queries/`, `writes/`, and `sql/` plus `*Store` services.
  It is not a second ports-and-adapters tree.
- `apps/server` is a Next.js and tRPC shell. Application behavior stays in
  `@flowmark/api`.
- Public SDK methods stay ordinary TypeScript and Promises. Effect execution
  stays at `client/runtime.ts` or another documented boundary.
- Pure core types and rules stay functions. Do not wrap them in services.

## Review procedure

1. Record the target path, lens, and mode. Confirm review before reading code.
2. Read the standards for that target. Note the rule you will apply, in the
   source that states it.
3. Read the target's `package.json` exports and a top-level map of its source.
   State what the package is for and which packages it may import.
4. Read representative use cases, ports, adapters, stores, routes, or
   components, plus their neighbors and tests. Search for the deviations the
   loaded standard forbids. Do not stop at the best file.
5. Compare each candidate finding with the written rule first. Then compare
   it with the established local pattern. Record why a difference is required,
   accidental, or only a preference.
6. Drop findings that are file length, taste, or a new architecture. Keep
   findings a maintainer could act on without a redesign.
7. Write the report. Do not edit files in this mode.

Dependency direction when the target is API, server, or db:

```text
apps/server → @flowmark/api use cases → ports ← persistence adapters → @flowmark/db
```

`core` must not import SDK, API, framework, or persistence implementations.
API use cases must not import Next.js, tRPC, Drizzle, or SQL. Database adapters
translate driver failures into API tagged errors. Server routes and tRPC
procedures decode protocol input and map outcomes. They do not own
authorization, ingestion, or query rules.

## What to look for

Apply a lens only when the target contains that kind of code.

**Architecture.** Ports stay free of adapter types. Use cases depend on port
tags. Adapters hide framework, network, and storage details. Composition roots
are the only place that chooses live adapters. Errors stay tagged and are mapped
at the protocol boundary. Expected failures stay in the error channel. There
is no success-shaped fallback. Public exports match the documented package
entry points.

**Effect.** Internal workflows are lazy `Effect.Effect` values, named with
`Effect.fn`, composed with `function*` / `yield*` and `.pipe`. Services are
`Context.Service` with an explicit `Layer.effect` layer. Resources use
`Effect.acquireRelease` in the owning scope. `Effect.tryPromise` appears only
at a real Promise boundary and maps to a tagged error with operation and cause.
Matchers are `Match`, `Result.match`, `catchTag`, and `catchTags`. Effects run
only at a process, request, CLI, or public SDK boundary.

**Persistence.** Reads are `queries/get-*.ts`. Writes use domain verbs. Shared
SQL lives in `sql/` without an extra `-sql` suffix. Store files only wire
service methods. `runQuery` receives `DatabaseOperation`, never a free string.
Queries stay project-scoped. Applied migrations are not edited.

**UI.** Reusable controls come from `@flowmark/ui`. One-off product layout
stays in the app. Tailwind utilities and semantic tokens are the styling.
Loading, empty, and error states exist for the surface under review. Status is
not color alone. Copy does not treat a reported result as verified business
success.

**Organization.** Kebab-case files named for domain behavior. One primary
service, port, adapter, query, or use case per file. Feature-owned code sits
with its feature. Tests stay out of `src/`. Extra nesting, vendor names in
application paths, and unrelated concerns in one file are worth reporting only
when they make the code harder to find or change.

**Consistency.** Naming, validation, error mapping, logging, and test style
should match the documented convention or the dominant local pattern. State
whether a deviation is justified. A single justified difference is not a
finding.

**Simplification.** Report duplication when the same rule exists in more than
one place and a change would have to be repeated. Prefer an existing local
helper over a new abstraction. Composition, currying, or a higher-order
function is useful only when it removes real branching or repeated policy.
Do not extract a helper for a few similar lines.

## Findings

Every finding cites repository code: path and the symbol, function, or region.
Then include the standard or established pattern, what differs, why it
matters, the suggested change, the benefit, and risk plus effort.

Use one class:

| Class                   | Meaning                                                        |
| ----------------------- | -------------------------------------------------------------- |
| Standards violation     | Conflicts with an explicit skill, ADR, or architecture rule    |
| Inconsistency           | Differs from an established convention without a stated reason |
| Improvement opportunity | A justified simplification or maintainability change           |
| Optional preference     | Style only. Omit unless the user asked for preferences         |

Do not label a preference as a violation. Do not propose a public contract
change, persisted format change, database migration, or error-semantics change
inside an ordinary finding. Call that out separately and stop there.

## Report

Use this structure and keep it short.

### Architecture assessment

What the target is, how it is structured, and whether that structure matches
the intended boundary. One short assessment, not a redesign.

### Standards compliance

Which standards were applied. Confirmed violations, or an explicit statement
that none were found. Name justified exceptions.

### Recommended improvements

Prioritize by value, then by risk. Lead with violations and inconsistencies
that can cause incorrect boundaries or repeated defects. Put low-value ideas
last or omit them.

For each item: class, evidence, impact, suggested change, benefit, risk, and
effort (`small`, `moderate`, or `large`).

### Proposed refactorings

Concrete file or function changes only for items worth doing. Skip this
section when there is nothing to move or extract. Do not draw a new package
layout for its own sake.

### What should remain unchanged

Name specific good decisions in this target, with paths. Include documented
exceptions the review might otherwise "fix".

### Suggested next steps

A short ordered list of worthwhile follow-ups. Do not create roadmap files,
ADRs, or tasks. The user decides what to implement.

## Refactor procedure

1. Restate the approved finding or the named scope. Refuse adjacent cleanup.
2. Apply [branch](../branch/SKILL.md) when this checkout is not already the
   task branch. Do not commit unless the user asks.
3. Read and follow the implementation skill for the target: architecture,
   effect, persistence, or UI. For a Next.js app, read the installed Next.js
   docs named by that app's `AGENTS.md` before changing framework usage.
4. Keep the change small. Preserve behavior, public exports, persisted data
   formats, database contracts, and error tags or status mapping.
5. If the change needs a public contract change, a migration, or a redesign,
   stop and present that decision. Do not start it inside the refactor.
6. Update or add the narrow tests that lock the preserved behavior.
7. Run the target's tests, typecheck, and lint with its `package.json` name,
   for example `pnpm --filter @flowmark/api test`. For a UI behavior or layout
   change, verify the affected flow in the browser, including the other
   surfaces that share the component or state.
8. Summarize what changed, what was verified, and what was left alone.

Follow [git safety](../../../.cursor/rules/git-safety.mdc). Do not push to
`main`, merge, deploy, publish, seed hosted databases, or run a hosted
migration. Schema work still follows [database rollout](../../../docs/migrations.md)
and needs its own approval. Do not reset local telemetry to make a test pass.

## Do not recommend

- Splitting a file because it is long.
- A new architecture for a package that already matches its boundary.
- Extra Effect services for pure functions or one-off helpers.
- Generic helpers without a second real caller.
- Wrapping Pulumi in Effect, or moving use cases into `apps/server`.
- Aligning SDK folders with API `features/`, or db stores with API ports.
- Broad rewrites, new dependencies, or product-scope changes.
- Deploying dev-harness or internal-docs.
- Style nits, import cosmetics, and comment rewrites without a behavioral or
  boundary reason.

## Invocation

Review: `Use the architecture-review skill on packages/api.`

Narrow: `Use the architecture-review skill on packages/db. Effect usage only.`

Refactor: `Use the architecture-review skill to implement finding 2 in packages/sdk.`

Another target: `Review apps/dashboard/src/components for file organization and UI consistency.`
