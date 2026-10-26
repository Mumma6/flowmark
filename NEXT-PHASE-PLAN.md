# Flowmark — Development Roadmap

> **Status:** Authoritative development plan, October 26, 2026. This replaces
> the October 25 learning plan.
>
> Product direction lives in [PRODUCT-VISION.md](./PRODUCT-VISION.md). Do not
> treat this file as a second vision. Infrastructure choices already made live
> in [MVP-INFRA.md](./MVP-INFRA.md) and
> [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md). This roadmap
> sequences that work and everything after the first public release.
>
> **Start here:** Phase 1, first unchecked task — prove register, ingest, and
> read on the hosted reference deployment. Neon, the four Vercel projects,
> and the public hostnames are done; see
> [Infrastructure](./docs/infrastructure.md). Do not publish to npm or
> instrument the card game in that same task. Ask before publishing or
> spending money.

## How to use this plan

Phases are ordered. Do not start Phase 3 feature work before a developer can
install Flowmark and inspect a real execution on the hosted service. Do not
start Phase 4 or 5 before Phase 2 has produced real executions whose results
are comparable.

Check a box only when the acceptance criterion is true in the running product,
not when the code merely exists. Deploying, publishing, making the repository
public, and destructive database actions still require explicit maintainer
approval.

A later phase may start early only under a pull-forward rule written in that
phase. Otherwise finish the phase you are in.

### Rules for every phase

- Flowmark observes application-owned work. It does not execute, schedule, or
  retry that work.
- The public SDK stays the current surface unless a concrete question cannot
  be answered from telemetry the application can already send.
- Insights say what changed, where, and which runs are the evidence. They do
  not invent causality, liveness, or verified business correctness.
- No workflow engine, generic logs or APM, OpenTelemetry migration,
  ClickHouse, Redis, queues, or a separate business dashboard.
- `apps/dev-harness` and `apps/internal-docs` stay loopback-only and are never
  deployed.
- The local harness scenarios are regression fixtures. Do not aggregate them
  into business trends.

## Shared foundations

These are the technical dependencies that more than one later capability
needs. Build each one for the first user-visible feature that requires it.
Do not build a general analytics framework in advance.

| Foundation | Why it is shared | When to build it |
| --- | --- | --- |
| Hosted API, database, auth, and an installable SDK | Every later phase assumes a developer outside this repo can send and read a run | Phase 1. Nothing in Phases 2–5 replaces it |
| Historical run queries | Discovery, peer comparison, intelligence windows, and outcome trends all need runs older than the latest 100, with a stated time range | First increment of Phase 3. Pull it forward during Phase 2 if the dashboard becomes slow or a real investigation needs a run outside the latest 100 |
| Compact run facts | Duration, status, result, environment, and release already land on `workflow_runs`. Operation-level explanation still needs event rows. Later windows should prefer these facts over recomputing every event | Use the columns that already exist in Phase 3. Add a longer-lived summary only if Phase 4 needs history beyond raw-event retention |
| Declared outcome fields | Filtering, aggregation, and business-readable summaries must agree on which result keys are counts, ratios, or categories | Phase 5, after Phase 2 shows the real result shapes. Not a new SDK method unless declaration cannot see the existing JSON |

The overview query is the reason the historical read path is real work, not a
speculative scale project. `projectRunSummaries` groups every event of every
run in the project. The run list then keeps 100 rows, while workflow metrics,
the 30-day chart, and peer comparison rebuild that full grouping. The
dashboard refetches the snapshot every 3 seconds. Week-over-week duration is
computed in the browser from those latest 100 runs, while volume and success
rate use the 30-day series. That split is acceptable for a first release with
little data. It is not an acceptable base for discovery or intelligence.

## Phase 0 — Current state

Objective: record what the next phases must not rebuild.

This inventory was checked against the source on October 26, 2026. The test
suite and the browser were not re-run for this plan. HANDOFF.md is no longer
in the repository; this phase is the baseline.

### Implemented and working in the local product

- SDK for Node, Next.js, and the browser: `workflow()`, `step()`,
  `operation()`, `progress()`, `error()`, `setProperties()`, `done()`,
  `fail()`, plus explicit `correlationId` and `parentRunId`. The same workflow
  name and external id continue one run. A second `started` is ignored.
  Continuation is covered by `packages/db/test/persistence/continue-run.test.ts`
  and an expedition ingestion test.
- Bounded JSON context and results. Terminal results are stored on the event
  and copied onto `workflow_runs.result`. `environment` and `release` are
  columns on the run. The public SDK already accepts both.
- Validated ingestion at `POST /v1/events` and `POST /v1/browser-events`.
  Event ids deduplicate. Browser events are origin-limited, rate-limited, and
  untrusted. `GET /api/health` is a liveness check and does not touch the
  database.
- PostgreSQL schema, committed migrations through `0007`, and
  `pnpm db:migrate` / `db:seed` / `db:setup`. Seed refuses production and
  non-loopback databases.
- Better Auth email and password. Registration creates the user, a project,
  and the first write key, and returns that key once. Dashboard reads require
  a session and project membership. Anonymous reads fail.
- Dashboard project switcher and create, revoke, and rotate for server write
  keys and browser keys.
- Dashboard overview: volume, success rate, median and p95, 30-day charts,
  week-over-week figures, slowest operations, and failure codes from `fail()`.
  Handled `error()` events are not those failure codes. They stay on the run.
- Run investigation: timeline, operations, last-reported progress, errors,
  context, up to four scalar result highlights, raw JSON, and explicit related
  runs. Comparison is this run's duration and status against the previous 20
  runs of the same workflow.
- Local harness with `invoices.import`, `inventory.sync`, and
  `orders.fulfill`. It is not a public demo.
- MIT license. `flowmark.dev` is owned. The reference stack is Neon, Vercel,
  and the four hostnames in MVP-INFRA. Neon Postgres is provisioned and
  migrated. The four Vercel projects deploy from `main` to those hostnames.
- Customer docs exist for the SDK, concepts, and dashboard. They point at
  `npm i @flowmarkdev/node`.

### Implemented, not yet verified outside this workspace

- Sign-up, session cookies, and key management on a hosted URL. The code
  path is proxied and the production auth URLs are set. A real registration
  on `https://app.flowmark.dev` has not been recorded.
- Serverless Postgres. The driver disables prepared statements. The API
  process is deployed and `/api/health` responds. A hosted ingestion and a
  signed-in read against Neon have not been recorded. Do not replace
  Drizzle or the driver unless that test fails.
- The six harness scenarios and the founder's earlier dashboard pass. Re-run
  the relevant tests when a release candidate claims them. Do not treat this
  document as a fresh test report.

### Partial

- Run discovery is a client-side filter over the latest 100 runs.
- Comparison does not look at operations, order, failure codes, results,
  environment, release, or context.
- Business results are visible per run. They are not defined, aggregated, or
  filterable.
- Empty project state uses `http://localhost:3003` in development and
  `https://api.flowmark.dev` otherwise.
- Quickstart cannot be followed from npm.

### Not started

Retention cleanup, npm publish, release CI,
instrumentation of the card game, waterfall views, historical search,
explainable change detection, and outcome definitions. The Neon database
itself is provisioned; see the infrastructure guide.

### Obsolete as backlog

Do not schedule these again: the Todo example, Supabase Auth, T3 Env, an
OpenTelemetry migration, key-management UI, the migration/seed split, and the
old requirement that the product stay small. The side-by-side log comparison
and the independent reader session are not release gates. They belong to
Phase 2 if a real investigation needs them. Cross-run business aggregates stay
out until Phase 5 has real, comparable results.

## Phase 1 — Public release

### Objective

A developer who is not in this repository can create an account, install
`@flowmarkdev/node`, instrument one process, and inspect its next execution on
`https://app.flowmark.dev`.

### Why it matters

The vision cannot be tested, and the card game cannot be instrumented, until
the product exists outside the monorepo. This phase is the public MVP. It is
not the advanced analytics program.

### Existing foundations

Local registration, ingestion, investigation, key management, migrations, and
the auth proxy. ADR 0006 and MVP-INFRA sections 3–9 are the deployment
baseline. Do not redesign hosting, auth, or the database.

### Deliverables

Ask before npm publish, a database restore, or another paid resource.

- [x] Create an isolated Neon project and a direct migration URL. Apply the
      committed migrations with `pnpm db:migrate`. Do not run seed. Do not
      enable demo mode. Done October 26, 2026: project `flowmark`
      (`snowy-dawn-12186433`), branch `production`, Postgres only, pooled
      runtime URL and direct migration URL in `packages/db/.env.neon`. Local
      demo stays on loopback. The hosted API is what reads this database.
      Operating notes:
      [Infrastructure](./docs/infrastructure.md).
- [x] Deploy `apps/server` and `apps/dashboard`, plus landing and docs.
      `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and
      `FLOWMARK_DASHBOARD_ORIGIN` are set on the API. The dashboard points
      at `https://api.flowmark.dev`. `FLOWMARK_DEMO_MODE` is unset and
      rejected in production. Done October 26, 2026. The variable catalog
      is in the infrastructure guide.
- [ ] On the hosted URLs, prove the whole path: register, receive the write
      key, send one `POST /v1/events` from outside the monorepo, and open that
      run while signed in. Confirm a second user cannot read the project.
      Confirm a wrong key is rejected and a database error is not reported as
      success.
- [ ] Confirm Better Auth cookies stay on the dashboard origin, sign-out
      works, and the API trusts only the dashboard origin. Keep the canonical
      auth instance in `apps/server`. The URLs are already set to
      `https://app.flowmark.dev`. The cookie behavior is not yet confirmed
      with a real session.
- [x] Attach the domains from ADR 0006: `flowmark.dev`,
      `docs.flowmark.dev`, `app.flowmark.dev`, and `api.flowmark.dev`.
      Landing and docs have no database or auth secrets. `www.flowmark.dev`
      redirects to the apex. The harness and internal docs are not deployed.
- [x] Replace localhost in the dashboard empty state and launch-facing
      copy with the public origins. The npm install command waits until the
      package is published.
- [ ] Document backup, restore, and rollback: where Neon keeps backups, one
      restore into an isolated database, and the rule that migrations run as a
      controlled step, not on every Vercel build. Prefer additive migrations.
- [ ] Add the 30-day telemetry cleanup from ADR 0006. Delete runs, and their
      events, older than 30 days in the reference deployment. Test it on
      disposable rows. Do not build a long-term summary table in this phase.
      Record in the ops notes that Phase 4 may need a longer window before
      this job is the only history.
- [ ] Make failed requests visible: structured API errors. `/api/health`
      already responds, and the infrastructure guide says where Vercel and
      Neon logs live. No new monitoring product.
- [x] Pack `@flowmarkdev/core` and `@flowmarkdev/node` and install them in a clean
      project outside the workspace. Prove ESM, types, Node without Next,
      the Next adapter export, and the browser entry without Node built-ins.
      Confirm `workspace:*` is gone and `effect` resolves as a normal
      dependency. Packages use the `@flowmarkdev` scope.
- [x] Publish installable prerelease `0.1.0-alpha.1` of `@flowmarkdev/core`
      and `@flowmarkdev/node` with **pnpm publish**. Registry install + hosted
      ingest smoke against `api.flowmark.dev` (including rejected key) passed.
      Workflow: `.github/workflows/publish-sdk.yml`.
- [x] Ship stable `0.1.0` on `latest` with Trusted Publisher validated.
      Next.js `after()` delivery still worth a dedicated smoke. Internal
      packages stay private.
- [x] Update the quickstart so an external developer can install
      `@flowmarkdev/node`, configure `FLOWMARK_API_KEY` and
      `FLOWMARK_API_URL`, mark one process, and find the run. Password reset
      does not exist yet.
- [ ] Label week-over-week duration so it cannot be read as the same
      population as the 30-day volume chart, or compute it from that chart's
      population. Do not leave the mixed definition unlabeled in the shipped
      dashboard.

### Dependencies

Maintainer approval to publish to npm. Neon, Vercel, and the domains
already exist. Publish under `@flowmarkdev` (not `@flowmark`). Make the
GitHub repository public at release for provenance. See
[SDK release](./docs/sdk-release.md).

### Acceptance

A person with a new account, the public docs, and a published package can
instrument one server-side process and open its run within a single sitting,
without this repository, a fixture key, or a manually edited database. The
acceptance test is that sitting. It has not been claimed yet.

### Not included

Server-side history beyond the current queries, waterfalls, outcome
aggregates, the card game, password reset, OAuth, organization invites,
alerting beyond logs and health, and durable offline delivery.

### Unresolved

- Whether the first public repository is this private GitHub remote made
  public, or a separate public remote. Open source is decided. The remote is
  not.
- Password reset stays off unless an email sender is explicitly chosen. The
  recommendation is to ship without it and say so in the docs.
- Browser ingestion stays supported. Verify it before calling the release
  done if a launch app needs the browser entry. The server path is the
  release-critical one.

## Phase 2 — Real-world validation

### Objective

Learn from genuine executions in the existing card game, especially processes
that span more than one HTTP request.

### Why it matters

The harness cannot tell us whether run ids are natural to persist, whether
the timeline explains a real process, or which result fields are stable
enough to aggregate later. Phase 4 and 5 should follow that evidence.

### Existing foundations

The SDK already continues `expedition.run` when a later request passes the
same workflow name and id. The game is not in this repository and is not
instrumented. Docs and one ingestion test use that name as an example only.

### Deliverables

Instrument the smallest set that answers the questions below. Do not mark
ordinary CRUD.

- [ ] Read the game's expedition, battle, and pack-checkout paths and write
      down where each process starts and ends, and which id already lives
      across the requests that belong to one execution.
- [ ] Instrument one expedition as a single workflow. Record draft, battle,
      and reward claim as steps or operations on that run. Persist the run id
      on the expedition record for that execution and pass it on later
      requests. Do not reuse a player, card, or account id that outlives the
      expedition.
- [ ] Instrument pack checkout as its own short workflow, with the operations
      and the reported result that make a partial open understandable.
- [ ] Send those runs to the hosted project from Phase 1. Investigate at least
      one completed expedition, one expedition that stopped before `done()` or
      `fail()`, and one pack checkout, using the dashboard rather than
      application logs.
- [ ] Write the findings in this file, or a short note it links: lines changed,
      where passing the run id was awkward, events that did not match the
      process, facts that were missing, and whether a real question was
      answered without the game's logs. Include whether the developer would
      keep the SDK installed.

### Dependencies

Phase 1 acceptance. Access to the card game repository. A hosted project and
write key dedicated to that game, not the local fixture keys.

### Acceptance

The hosted project contains real expedition and pack-checkout runs. A written
note answers the learning questions from those runs. Product changes after
this phase cite that note.

### Not included

Instrumenting the rest of the game. A synthetic aggregate of harness data. A
new SDK concept proposed before the findings exist. Automatic context
propagation.

### Unresolved

Treat a battle as part of `expedition.run` unless the findings show that a
battle is investigated on its own. A separate battle workflow would use
`parentRunId` or `correlationId`, which the SDK already has. That split is a
decision after seeing the game's request boundaries, not before.

### Pull forward

If a real run falls outside the latest 100, or the 3-second snapshot becomes
too slow to investigate the game, start the Phase 3 read-path increment
before any visualization work.

## Phase 3 — Advanced run investigation

### Objective

Make one execution understandable in detail, comparable with its peers, and
findable after it leaves the latest 100 runs.

### Why it matters

This is the investigation pillar. The support path in the vision — find
yesterday's import from an explicit reference, see what was skipped, and open
the execution — starts here. So does the expedition that should be read as a
24-minute process rather than three requests.

### Existing foundations

Timelines, operation intervals, progress snapshots, related runs, and
duration comparison against 20 peers. Run rows already store context,
result, environment, release, and external id. Indexes exist for workflow
plus start time, external id, correlation, and parent. They do not yet serve
a paged historical API.

### Deliverables

Build these in order. The first increment is the shared read path.

- [ ] **Historical read path.** Page runs on the server by workflow and time.
      State the population of every overview number. Bound the snapshot so a
      dashboard refresh does not regroup every event in the project. Add
      indexes only for the filters this increment executes. Keep project
      scope on every query.
- [ ] **Run discovery.** Filter that history by workflow, external run id,
      explicit context such as a reported batch or expedition id, `fail()`
      code, operation duration, environment, and release. A result filter may
      wait for Phase 5 if the predicate would freeze an undeclared JSON
      shape. Link every result to the run.
- [ ] **Advanced comparison.** Against a stated peer group, show differences
      in total duration, operation duration, operations present or absent,
      order, failure codes, reported outcomes, environment, release, and
      relevant context. Say where the recorded timeline differs. Do not state
      a cause the events do not show.
- [ ] **Process visualization.** Render recorded operation intervals as a
      waterfall, including overlap, milestones, idle time between recorded
      points, last-reported progress, and links to related runs. Do not draw
      an orchestration graph or a causal edge.

### Dependencies

Phase 1. Phase 2 should inform which context keys and peer groupings matter,
but the read path can start under the pull-forward rule without waiting for a
finished write-up.

### Acceptance

Someone can find an execution by a reference the application reported, open a
waterfall of its recorded operations, and see how it differs from the stated
peers, including a run older than the latest 100. A comparison with too few
peers says so.

### Not included

Anomaly detection, outcome definitions, a query language, AI narration, and
automatic tracing across services the application did not link.

### Unresolved

Which context keys are searchable. Prefer keys the application already sends
and a person would type, such as an expedition or batch id. Do not index
arbitrary JSON. Decide the peer group in the UI: previous runs of the same
workflow, the same release, or an explicit selection. The current implicit
"previous 20" is the fallback until that choice is designed.

## Phase 4 — Workflow intelligence

### Objective

Explain observable change: what changed, where it changed, and which
executions are the evidence.

### Why it matters

Volume, p95, and success rate are already on the overview. They do not yet
answer why. This phase is the difference between a chart and the intelligence
pillar. Deterministic comparisons are enough. AI is not part of the design.

### Existing foundations

Thirty-day series, week-over-week rates, all-time top operations by total
duration, and top `fail()` codes. Operation rows store name, duration, and
terminal type. Run rows store release and environment when the application
sends them. Phase 3 supplies a bounded historical query.

### Deliverables

- [ ] For a stated window against the previous window, attribute a duration
      change to named operations, with the sample size and the runs that
      moved the number.
- [ ] Attribute a success-rate change to `fail()` codes in the same way.
      Keep handled `error()` events out of that explanation unless a separate,
      clearly labeled view is added for them.
- [ ] Show which finished runs sit farthest from the peer duration or status
      baseline, and open them.
- [ ] Compare the same workflow across two releases when both releases have
      enough finished runs. Show the same operation and failure-code
      breakdown. Withhold the comparison below a stated minimum.
- [ ] Surface uncertainty in the UI: window, count, and the absence of a
      prior window. Do not describe a thin sample as a regression.
- [ ] Revisit the 30-day raw retention before relying on these views. If the
      game or the next user needs a longer explanation window, keep compact
      run and operation facts beyond raw event deletion. Do not keep every
      event forever by default.

### Dependencies

Phase 3 read path. Enough real runs from Phase 2, or from the next real
project, to populate two windows. Do not demonstrate this phase on the
harness.

### Acceptance

Given a real duration change or success-rate change, the overview names the
operations or failure codes involved and links to the runs. A viewer can tell
when the evidence is too thin to say.

### Not included

Causal claims, suspected-stuck detection, AI-written explanations, and
business-outcome trends that need Phase 5 definitions. A generic anomaly
framework with no workflow question attached.

### Unresolved

The minimum sample size and the default window. Start with the windows the
dashboard already shows, 7 days against the previous 7, and change them only
when real data makes those windows misleading. Stuck detection stays out
until a workflow has an explicit expected duration supplied by the
application, not inferred from silence.

## Phase 5 — Business outcome analytics

### Objective

Turn developer-reported results into comparable, business-readable facts,
with a path back to the runs.

### Why it matters

`988 imported, 12 skipped` is already visible on one run. The support
example, the release comparison, and the question "are we skipping more?"
need those numbers to be declared, aggregated, and filtered without treating
every JSON value as a metric.

### Existing foundations

`done()` and `fail()` already accept a bounded result. The run row stores it.
The dashboard shows up to four scalar highlights and the raw JSON. Phase 2
records the actual keys the game sends. Phase 3 can filter once a field is
safe to filter.

### Deliverables

- [ ] From the Phase 2 results, choose the first declared fields. For each
      field record meaning, kind (count, ratio, or category), and whether it
      may be aggregated. Leave ids as search context.
- [ ] Store that declaration in the product, per workflow, without a new
      public SDK method if the existing result JSON already contains the
      values. Add an SDK or config field only if the declaration cannot be
      made accurately from the current payload, and discuss that change
      before implementing it.
- [ ] Aggregate declared numeric fields over the same windows as Phase 4.
      Show categories as counts. Show missing results, partial runs, and
      failed runs with a result as themselves, not as zeroes and not as
      successes.
- [ ] Let a person filter runs by a declared field, compare the field across
      two releases, and open the runs behind any total.
- [ ] Present a short workflow reading a non-developer can use: what this
      process reported accomplishing in the window, what changed, and which
      executions to open. Keep the application-reported label.

### Dependencies

Phase 2 findings and the Phase 3 historical query. Phase 4's window and
sample-size behavior should be reused, not reinvented.

### Acceptance

For one real workflow, a person can see a declared outcome change, trust the
population it was computed from, and open a run that explains it. An
undeclared JSON key does not become a chart. A completed run that skipped
records is not presented as a fully successful business result.

### Not included

A BI workspace, an arbitrary query language, automatic inference over every
JSON property, customer identity collection, and any claim that Flowmark
verified the numbers.

### Unresolved

Where the declaration lives: dashboard configuration is the recommended
start. A checked-in manifest is an alternative if the game already wants
outcome meaning next to the instrumentation. Decide when the Phase 2 result
shapes are known. High-cardinality fields stay out of aggregates even if
someone declares them.

## Decisions needed before implementation

1. **Publish and visibility.** Decided: publish `@flowmarkdev/core` and
   `@flowmarkdev/node`; make `Mumma6/flowmark` public at release. Bootstrap
   publish still needs an npm login and the `flowmarkdev` org.
2. **Password reset.** Recommendation: ship Phase 1 without email, and
   document it. Change this only if a sender is already chosen.
3. **Retention.** Recommendation: implement the decided 30-day deletion in
   Phase 1, and decide on longer-lived summaries at the start of Phase 4
   rather than before the first user. Confirm that deleting the game's raw
   runs after 30 days is acceptable.
4. **Battle boundaries.** Recommendation: one `expedition.run` until Phase 2
   shows that a battle is its own investigation unit.

## What this plan no longer treats as the goal

The October 25 plan optimized the next step for a single synthetic import and
a very small surface. Those scenarios remain useful fixtures. The goal now is
a public, carefully operated product, proven on the card game, and then
deepened in investigation, intelligence, and reported outcomes. Each increment
should be visible to a person using Flowmark. None of them should widen
Flowmark into an execution platform or a general observability suite.
