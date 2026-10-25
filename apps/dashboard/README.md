# Flowmark dashboard

## Pages and data

- **Overview:** project metrics, recent daily volume, five workflow summaries,
  and five recent runs.
- **Workflows:** name-prefix groups, namespace/search filters, and 12 workflow
  rows per page.
- **Workflow detail:** all-time workflow summary plus matching runs from the
  project's latest-100 snapshot. A `?search=` URL parameter prefills run search,
  including links from the local harness using an external SDK run ID.
- **Runs:** search by SDK run ID, workflow, checkpoint, correlation or parent ID;
  filter by workflow, status or naming namespace. Newest first by default;
  sort and optionally group by workflow. At most 15 run rows per page.
- **Run detail:** outcome first; separate timeline, context and related-run tabs.
  Timeline pages contain 15 events with expandable payloads. Related-run tables
  contain at most 10 rows each.
- **Settings/account previews:** explain the fixed development account. Account
  forms are explicitly disabled previews, not implemented authentication.

Filtering and pagination of run summaries are client-side over the latest 100
project runs, not full-history server queries. The workflow list and aggregate
metrics retain their existing backend scope. Namespace grouping is inferred
from names, not trusted event provenance. No workflow execution, retry,
business-result verification, or authentication was added.

## UI and theme

All application styling uses Tailwind utilities. `app/globals.css` contains
only Tailwind directives and shadcn theme variables: dark charcoal surfaces
and lime accents matching the landing page, with an accessible light variant.
Dark is the default; saved appearance preferences still take precedence.

Reusable shadcn-style controls live in `@flowmark/ui`: tables, badges, inputs,
native selects, breadcrumbs, pagination, alerts, skeletons, separators, sheet,
cards, tabs, accordion, buttons and code blocks. The mobile navigation sheet
uses the existing Base UI dialog for focus management and dismissal. Do not
add app-local copies, custom selector stylesheets, or another UI kit.

`dashboard-data.ts` owns pure filtering/grouping/pagination helpers;
`dashboard-components.tsx` composes shared controls. Data queries retain
project scoping, the server-held read key, and existing automatic refresh.

## Validation

```bash
pnpm --filter @flowmark/ui lint
pnpm --filter @flowmark/ui typecheck
pnpm --filter @flowmark/dashboard test
pnpm --filter @flowmark/dashboard lint
pnpm --filter @flowmark/dashboard typecheck
pnpm --filter @flowmark/dashboard build
```

Also inspect desktop/mobile navigation, table overflow, filtering/pagination,
keyboard interactions, loading/error states, and both appearance modes.
