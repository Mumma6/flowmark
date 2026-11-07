# Flowmark Studio

The authenticated Studio workspace. It starts in Explore: select a process,
search its execution evidence, inspect a run and return to the same filters.
The package name remains `dashboard`. Hosting and domains keep their existing
configuration.

Saved investigations are not built. Connect explains agent and manual setup and
does not claim that an agent is connected. Studio does not render the landing's
synthetic examples.

Anonymous visitors are redirected to sign in. Registration creates the account;
onboarding/Settings creates the first project and write key. Existing local demo
setup supplies `local@flowmark.test` / `local-dev-only`. Do not seed or reset telemetry just
to verify presentation changes.

The dashboard proxies `/api/auth/*`, `/api/register`, and `/api/trpc/*` to the
API. Server proxy code signs client identity with
`@flowmark/auth/client-identity`. The browser session client stays in this app
and calls `/api/auth`; it does not import the auth factory, database, or
signing secret. User and session policy live in `@flowmark/auth`.

## Architecture

See [Studio architecture](./ARCHITECTURE.md) for feature ownership, Effect
execution boundaries, data access, configuration and verification. Next routes
compose views from `features/`; shared dashboard presentation lives in
`features/shared/`, and runtime adapters/configuration live beside their owning
features (`auth`, `platform`, `runs` and `reporting`).

## Pages and populations

- **Explore (`/`):** the first Studio workspace. Its process rail uses the
  existing project snapshot; execution evidence uses full, cursor-paginated
  `run.list` through the existing explorer controller. Period analytics (summary,
  reported results and failure groups) reuse Insights/Attention controllers;
  on narrow viewports execution evidence appears first, analytics second. Analytics
  tab state uses the `analytics` query key so it does not collide with run
  `view` or history `view=runs`. Search/process/status filters stay in the URL; all applied conditions remain visible. All filters
  opens the existing history with the exact same conditions. Process selection
  becomes a compact selector on mobile. Run links preserve the return cohort.
- **Overview (`/overview`):** four seven-day execution metrics from `project.intelligence`,
  all-recorded workflow summaries, failures within the latest-100 snapshot,
  five recent runs with reported results, 30-day trend charts, observed-change
  evidence and all-recorded diagnostics. Populations are labelled separately.
- **Workflows:** namespace/search/sort controls and name-prefix groups under one
  table header; 12 workflow rows per page. Summary counts are all-recorded.
- **Workflow detail:** all-recorded execution summary, full server-paginated run
  history with reported results, explicitly scoped snapshot charts and diagnostic
  evidence. `?search=` prefills history search.
- **Runs:** full history through `run.list`, 25 rows per page, filtered on the
  server by workflow, lifecycle, search, namespace, failure code, environment,
  release and dates. Advanced filters are disclosed and applied values stay
  visible. Free-text search covers the existing IDs, workflow, and failure-code
  contract. Exact business-reference filters apply only to keys enabled for
  that workflow. Result predicates apply only to declared fields.
- **Run detail:** workflow identity, recorded lifecycle and application-reported
  result; Outcome, Timeline, Context, Compare and Related runs tabs. Timeline
  offers a waterfall and paginated event table. Peer sample size and recorded
  links remain explicit; raw data/exports are available without dominating.
- **Connect (`/connect`):** agent and manual SDK setup with separate copied, configured, and observed states, instrumentation guide links, and recovery for lost keys or wrong project/origin.
- **Settings:** project creation/rename, write/browser key management, Connect setup help
  and account controls. Project switching stays in the navigation.
- **Search:** the navbar command palette opens with ⌘K / Ctrl+K. Pages and
  project names resolve locally. Workflow names, the existing run text
  contract, and exact enabled business references come from `search.project`
  for the selected project. References match configured keys exactly; other
  property values stay unsearchable.
- **Account and workspace:** the shared Sheet holds navigation to history,
  overview, Connect, settings and the setup guide, alongside appearance and sign-out.
  Project loading failures show retry feedback rather than an empty account.
- **Onboarding:** five persisted setup steps retain the existing project/key
  and completion logic. Installation uses the validated API origin. Agent
  instructions contain no write key and do not establish an agent connection.
  Completed users can revisit `/onboarding?mode=guide`; that mode changes only
  local step navigation and never rewrites completed onboarding state.

Technical completion is not business success. Missing terminal telemetry is
labelled **No final outcome**, and progress is **Last reported**. Result scalar
highlights remain application-reported values. Declared result fields already
support business analytics with revision/coverage rules; arbitrary JSON does not
become a metric. Expectations are explicit observed confirmations, not a liveness
claim. Flowmark does not execute or retry application work.

## Design and shared UI

See [Flowmark design system](../../docs/design-system.md) for typography, spacing,
color/status meanings, ownership and data-scope rules. Use Tailwind utilities,
semantic theme variables and shared `@flowmark/ui` controls. Dashboard and harness
use Tailwind 3; web/docs use Tailwind 4. Recharts composes through shared chart
primitives. Studio uses a top bar and horizontal Explore/Processes/Insights/Attention
navigation. The account Sheet uses Base UI focus management. Theme
preferences include system/light/dark with dark as the default.

Run detail and the landing illustration use the same `RunSnapshot` component
from `@flowmark/ui`, not separate imitations. `buildRunSnapshot` projects live
recorded events into its presentation props: up to four scalar result fields,
explicit lifecycle, duration and up to eight recent milestones. Raw results,
full Timeline/Operations/Table views, progress history, comparisons, related
runs and JSON exports remain available. The projection keeps partial results
on failure and does not infer activity from missing terminal telemetry.

## Validation

```bash
pnpm --filter @flowmark/ui lint
pnpm --filter @flowmark/ui typecheck
pnpm --filter @flowmark/dashboard test
pnpm --filter @flowmark/dashboard lint
pnpm --filter @flowmark/dashboard typecheck
pnpm --filter @flowmark/dashboard build
```

Inspect desktop/mobile navigation, filtering/clear/pagination, reported results,
all investigation tabs, keyboard/focus, chart value disclosures, overflow, both
themes and independent loading/error/empty states. Changes to shared defaults
also require checking directly affected consumers. Never claim production
validation from local fixtures.

## Accent hierarchy

The theme-aware `highlight` token adds lavender to navigation, section markers,
inspection context and auth surfaces. Light mode uses a darker violet for
contrast. Primary actions remain green; execution, outcome and error colors
retain their semantic roles. Use the accent sparingly, not as a general panel fill.
