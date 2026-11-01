# Flowmark design system

Flowmark helps people understand what application workflows report accomplishing,
then follow that result to recorded evidence. Its interface should feel calm,
precise and recognizably Flowmark: charcoal surfaces, restrained lime emphasis,
clear typography and useful information before technical detail.

## Product meaning comes first

Show workflow identity, run lifecycle and reported result as separate facts.
A completed run can report skipped items or a legitimate negative business
result. It does not establish that an external business process succeeded.

- **Completed:** application reported terminal completion.
- **Failed:** application reported terminal failure.
- **No final outcome:** no terminal event recorded; no claim the work is active.
- **Not reported:** the application did not attach the relevant result.
- **Last reported progress:** an absolute snapshot, never a heartbeat.

Do not classify arbitrary result keys as success, warning or failure. Do not infer
pending confirmations, overdue work, root causes or business outcome categories.
Business outcome distributions require an explicit workflow-specific contract.
The current dashboard presents execution summaries and individual reported
results; it does not claim to implement aggregate business outcome analytics.

## Foundations

Use Tailwind utilities and semantic theme variables. No app-local CSS classes,
CSS modules or inline layout styling. Data-driven chart geometry may use inline
values. Dashboard theme variables live in
[globals.css](../apps/dashboard/app/globals.css) and map through
[tailwind.config.ts](../apps/dashboard/tailwind.config.ts).

Dark is the default, with saved light/system preferences respected. Theme
selection must hydrate consistently before reading the client preference.

### Color roles

- `background` / `foreground`: main canvas and primary text.
- `card` / `card-foreground`: coherent information panels.
- `muted` / `muted-foreground`: quiet grouping and supporting text.
- `border`: structural division, not decoration around every item.
- `primary`: Flowmark mark, deliberate primary action and selected navigation.
  Dark HSL 98 82% 78%; light HSL 105 45% 26%.
- `success`: explicit recorded completion; separate from brand emphasis.
- `destructive`: explicit terminal failures and failed requests.
- `warning` / `info`: available semantic roles; use only for defined meaning.
- `chart-1` through `chart-5`: chart series, paired with visible labels.

Success Badge colors have semantic CSS-variable fallbacks so shared consumers
without the dashboard palette still render correctly. Status includes a visible
text label and a marker; it must never rely on color alone. Do not paint an entire
workflow green because its recorded runs completed.

### Typography

Keep the system sans stack; no remote font dependency. Use sentence case.
Page headings use 28/36 px on desktop and 24/36 px on mobile; section headings
16/24 px semibold; body and tables 14 px; supporting text 12 px with readable
line height. Main metrics use 30/36 px medium and tabular numerals. Monospace is
for exact IDs, codes and payloads, not ordinary explanation.

### Spacing and geometry

Use a 4 px base and the repeated steps 8, 12, 16, 24 and 32. Main content padding
is 32 px on desktop and 16 px on mobile. Typical section gaps are 24–28 px and
panel padding 20–24 px. Use the existing `--radius: 0.7rem` and derived radii.
Avoid nested metric cards, gratuitous shadows and ornamental borders.

Sidebar width is 224 px. Main content is capped at 1440 px. Navigation uses
36 px controls on desktop and a 44 px menu target on mobile. Investigation and
Settings tabs use the shared line variant with 44 px tab targets. Tables allow
rows to grow for results and long identifiers. Mobile run summaries use a
semantic list rather than hiding essential values in a wide table.

## Component ownership

[Shared exports](../packages/ui/src/index.tsx) are authoritative. Import reusable
controls from `@flowmark/ui`: Button, Card, Table, Badge, Select, Input,
Breadcrumb, Tabs, Sheet, Accordion, Alert, Skeleton, Pagination and chart
primitives. Keep `FlowmarkMark` and the wordmark accent dot.

Use a Card for one coherent data panel. Open sections and metric strips can use
semantic HTML and structural dividers. Workflow summaries, result highlights,
run lists and Overview composition belong to `apps/dashboard`.
`RunSnapshot` is a deliberate shared product presentation: both the public landing
and dashboard run detail render the same identity/status, result strip, milestone
selector and payload inspection. The dashboard owns the projection from recorded
events; the landing passes synthetic illustration props. This component performs
no fetching and owns no SDK, API, persistence or business-outcome classification.
Its Tailwind 3/4-compatible classes and dark palette/system fonts match across
both consumers. Add a primitive
to `packages/ui` only when missing reusable behavior warrants it. Do not create
an app-local UI kit or thin wrappers around every semantic element.

Examples:

```tsx
import { Badge, Button, TabsList } from "@flowmark/ui"

<Badge variant="success">Completed</Badge>
<Button variant="outline" size="sm">Refresh</Button>
<TabsList variant="line" aria-label="Run investigation sections">
  {/* Shared TabsTrigger components */}
</TabsList>
```

Most icons are neutral Lucide icons at 16 px. Decorative icons are hidden from
assistive technology. Navigation and evidence use real links with visible focus.
Keep appearance, project settings and documentation accessible without competing
with the primary Overview → Workflows → Runs navigation.

### shadcn workflow

The shared registry and dashboard metadata use the `base-rhea` preset, neutral
base and CSS variables. The shared registry points to the dashboard's Tailwind 3
configuration and token stylesheet as its reference. This is authoring metadata,
not a runtime theme or permission to regenerate existing components.

Installed implementations remain the source of truth: Base UI supplies the
interactive controls and Radix Slot supports existing `asChild` composition.
Inspect existing implementations and state attributes before using the CLI.
Do not overwrite the component collection from a preset. Dashboard/harness use
Tailwind 3; web/docs use Tailwind 4. Verify affected consumers when changing a
shared primitive; do not upgrade styling frameworks for a dashboard redesign.

## Information hierarchy and data scope

Overview shows one four-metric execution strip, workflows and recent recorded
failures, latest runs with reported results, then trends and technical evidence.
Workflow detail leads with run history and reported results before diagnostics.
Run detail starts with reported outcome/result and progressively reveals timeline,
context, comparison and explicitly related runs. All audiences use the same facts.

Every metric needs its period, cohort and denominator:

- Overview execution metrics use runs **started** in the stated seven-day UTC
  intelligence window. Completion is completed / finished, not business success.
  The count without a final outcome remains visible. Duration percentiles use
  measured finished runs from that same window.
- Workflow summary rows use all recorded runs and explicitly say so.
- Recent failures come from the latest 100 recorded project runs; absence means
  no failures in that snapshot, not no historical failures.
- Project trend charts use the 30-day daily aggregate. Workflow charts use the
  explicitly labelled latest-100 project snapshot slice.
- Run explorer filters apply to its full server-paginated history, not other
  sections. Do not add a global period/environment selector until it can govern
  every panel it appears to control.

Use server-provided window percentiles; never average daily medians or p95 values.
Completion-rate deltas use percentage points. A missing baseline is not a zero
baseline. Comparisons describe evidence, not a regression verdict or a cause.

Business outcome panels and enabled business-reference search present
application-reported evidence. A shared period control must not be added until
it governs every panel it appears to control. Do not invent aggregates or
change contracts to fill a layout.

## Interaction and verification

Keep primary filters visible and advanced filters in a labelled disclosure.
Applied values remain visible when advanced controls are collapsed. Never turn a
request error into a zero count, empty chart or apparently successful fallback.
Distinguish loading, no project data, no matches, missing result, missing baseline
and failed requests. An empty project gets a concrete setup path, not perpetual
loading tiles.

Charts use units, UTC labels and named series. Distinguish median and p95 with
line style as well as color. Null duration gaps remain gaps. Daily values are
available through an accessible disclosure. Diagnostic bar charts retain tables.

Verify desktop, laptop, mobile, both themes, keyboard/focus, Sheet dismissal,
long identifiers, zoom/reflow and reduced motion. Preserve layout during refresh
and retain explicit errors. Target WCAG AA text contrast. Use the pinned pnpm
commands in the [dashboard README](../apps/dashboard/README.md).
