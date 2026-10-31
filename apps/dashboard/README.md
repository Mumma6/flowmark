# Flowmark dashboard

Anonymous visitors are redirected to sign in. Registration creates the account;
onboarding/Settings creates the first project and write key. Existing local demo
setup supplies `local@dev` / `local-dev-only`. Do not seed or reset telemetry just
to verify presentation changes.

## Pages and populations

- **Overview:** four seven-day execution metrics from `project.intelligence`,
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
- **Settings:** project creation/rename, write/browser key management, setup help
  and account controls. Project switching stays in the navigation.

Technical completion is not business success. Missing terminal telemetry is
labelled **No final outcome**, and progress is **Last reported**. Result scalar
highlights remain application-reported values; no arbitrary JSON is interpreted
as aggregate business outcome analytics. No workflow execution/retry was added.

## Design and shared UI

See [Flowmark design system](../../docs/design-system.md) for typography, spacing,
color/status meanings, ownership and data-scope rules. Use Tailwind utilities,
semantic theme variables and shared `@flowmark/ui` controls. Dashboard and harness
use Tailwind 3; web/docs use Tailwind 4. Recharts composes through shared chart
primitives. The mobile navigation Sheet uses Base UI focus management. Theme
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
