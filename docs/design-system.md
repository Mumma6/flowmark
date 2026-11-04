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

Do not classify arbitrary result keys as success, warning or failure. Pending
and overdue confirmations require the existing explicit expectation contract;
missing telemetry alone establishes neither. Business analytics use declared
fields, immutable revisions, exact cohorts and visible coverage. These capabilities
already exist; preserve their semantics when composing Studio views.

Product 1.0 introduces a contextual Studio over this foundation. Preserve the
current palette, mark, shared components and accessibility. Context, answer and
evidence should form one continuous interaction. Existing page compositions below
describe current behavior, not a permanent navigation constraint.

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

Studio uses a two-level top bar and content capped at 1680 px. Explore has a
230–260 px contextual process pane on desktop, replaced by a selector on mobile.
Global navigation fits narrow screens; account utilities live in a shared Sheet.
Investigation and
Settings tabs use the shared line variant with 44 px tab targets. Tables allow
rows to grow for results and long identifiers. Mobile run summaries use a
semantic list rather than hiding essential values in a wide table.

## Component ownership

[Shared exports](../packages/ui/src/index.tsx) are authoritative. Import reusable
controls from `@flowmark/ui`: Button, Card, Table, Badge, Select, Input,
Breadcrumb, Tabs, Sheet, Dialog, Command, Accordion, Alert, Skeleton, Pagination and chart
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
with the primary Explore → Processes → Insights → Attention navigation.

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

Explore is the entry point: process selection, full recorded execution history,
visible filter conditions and links into evidence. Its process-summary and
run-list loading/error states are independent. All filters preserves the same
cohort in the existing history. The retained Overview at `/overview` shows one
four-metric execution strip, a short link to Issues, the
workflow list and the latest runs. Insights owns period trends, workflow
comparisons and declared business outcomes. Issues owns derived failure groups
and the runs behind them. Workflow detail leads with run history and reported
results before diagnostics. Run detail starts with reported outcome/result and
progressively reveals timeline, context, comparison and explicitly related runs.
All audiences use the same facts.

Every metric needs its period, cohort and denominator:

- Overview execution metrics use runs **started** in the stated seven-day UTC
  intelligence window. Completion is completed / finished, not business success.
  The count without a final outcome remains visible. Duration percentiles use
  measured finished runs from that same window.
- Insights and Issues use the same half-open UTC start cohort, for 7 or 30 days,
  compared with the immediately previous window of the same length. Daily bars
  zero-fill days with no starts. Workflow medians are not averaged into the
  headline percentiles.
- Failure groups are derived at read time: one workflow plus one terminal
  failure code, one count per failed run. They are not tracked issues.
- Workflow summary rows use all recorded runs and explicitly say so.
- Workflow diagnostics that mention the latest 100 runs are a snapshot slice,
  not the Issues population.
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

## Product 1.0 landing and Studio direction

The landing establishes the visual direction for Product 1.0. The authenticated
application now evolves as Studio in `apps/dashboard`, with its existing hosting
configuration. Keep charcoal surfaces, the Flowmark mark and
accent dot, system fonts and restrained lime. Its neutral charcoal palette
reduces the old green cast. The public site is dark-only; authenticated product
surfaces continue to support their existing themes.

Use large editorial headings (fluid 45–88 px for the public hero), short readable
explanations and open sections divided by fine rules. Monospace identifies
references, source, context and exact payloads. Avoid decorative card grids and
ornament competing with evidence. Soft lime
light cones, a faint grid and slowly travelling background beams frame the hero.
Keep them behind content and disable their movement under reduced motion. Studio
gets a stronger rim light, ambient glow and selected-state accents so the product
illustration stands out without changing status colors or interaction behavior.

The primary visual is a working contextual investigation, not a screenshot:
process selection → connected evidence → inspector → existing run detail.
Studio, agent and structured-data views preserve the selected case. A shared
Dialog reveals `RunSnapshot`; its schema and dashboard consumer are unchanged.
An explicit observation snapshot accompanies missing-confirmation evidence.
Completed execution remains separate from reported results and expectations.
RunSnapshot uses 20 px metric values and 12 px metric padding on narrow screens,
returning to 28 px and 16 px at the small breakpoint. Inspection initially focuses
its title so long mobile content opens at the beginning.

Organization perspectives adapt the question and depth around the same reference.
Agent and portable-view illustrations show how that context travels; they do not
simulate authorization or a real connected client. Keep fictional organizations
and synthetic data identifiable. Landing copy describes the full Product 1.0 in
present tense; actual operational state elsewhere stays factual.

On narrow screens, navigation becomes the shared Sheet, investigation selection
becomes a compact two-column list, and the journey and inspector stack. Preserve
all evidence and actions rather than clipping a desktop console. Use shared
Tabs, Button, Input, Sheet, Dialog and Accordion; no second component system.
Keep visible keyboard focus, meaningful no-match recovery, Escape dismissal and
focus restoration. Entrance motion and anchor scrolling honor reduced motion.

Platform uses one evidence-to-interface diagram rather than a disconnected grid
of infrastructure features. Show the application-owned process, shared meaning
and the people/agent/API clients together. Reuse the same fictional reference
across illustrations. Diagram connectors are decorative; labels and working
links carry the meaning on mobile and for assistive navigation.

Everywhere pairs one client-independent conversation with synthetic evidence and a
portable view that switches host shells while keeping the same facts. Shared
RunSnapshot remains the inspection surface. Match Studio’s fine lime borders,
quiet glows and selected-state emphasis; use the existing warning/success roles
for evidence status. Illustrative hosts do not perform live tool calls, authorize
connections or create a second analytics/presentation system.

Follow the page order in desktop/mobile navigation, product links and footer:
Studio → Platform → Everywhere. Keep one useful agent conversation instead of
client tabs that only substitute prompt text. The SDK illustration follows the
same fictional booking from application code into context, a reported result and
an expected confirmation. Expandable details explain distinct signals; code copy
uses the executable example. Keep the closing invitation bold and concise, with
open-source/self-host details integrated there rather than a separate section.

## Studio workspace, authentication and setup

Use the landing's neutral charcoal and restrained lime in real application
surfaces, with the existing light/system preferences preserved. Workspace
headings may use 30–40 px editorial type. Dense execution rows use 13–14 px for
identity and 10–12 px for secondary metadata; keep long explanations readable.
Separate reported lifecycle, business results and absent confirmations.

Studio has horizontal product navigation and a contextual process pane rather
than the old global sidebar. A real project selector and the existing command
palette remain visible; settings, theme, setup help and sign-out are grouped in
the account Sheet. Keep the source of filtered evidence visible and provide
clear no-match recovery. Empty accounts lead to project creation.

Authentication pairs a focused form with the product story. Setup uses a
five-step rail, compact mobile progress, a distinct content panel and real
loading/error states. Each step change focuses its heading. Code panels use the
shared copy controls and the validated API origin. Existing-key evidence does
not mean the application is installed, and copied instructions never mean an
agent is connected. The completed user's setup guide is a local walkthrough,
not a reset of their saved onboarding state.
