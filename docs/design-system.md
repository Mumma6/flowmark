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
Investigation and Settings tabs use the shared line variant with 32 px desktop
controls and 40 px mobile targets. Use the shared Button defaults (36 px), or
32 px small/utility actions. Avoid oversized minimum-height and text-size
overrides; dense desktop controls keep larger mobile hit areas when needed.
Buttons use intrinsic width by default, including inside grid forms. Opt into
`w-full` explicitly when the layout calls for a full-width action. Tables allow
rows to grow for results and long identifiers. Mobile run summaries use a
semantic list rather than hiding essential values in a wide table.

Studio uses shared `StudioChrome`, `StudioWorkspace`, `StudioProcessPane` and
`StudioEvidenceList` presentation primitives. The public landing uses independent
process diagrams rather than recreating Studio. Both consume shared controls and
tokens. Keep synthetic disclosures visible and preserve actual Studio query/error states.

## Component ownership

[Shared exports](../packages/ui/src/index.tsx) are authoritative. Import reusable
controls from `@flowmark/ui`: Button, Card, Table, Badge, Select, Input,
Breadcrumb, Tabs, Sheet, Dialog, Command, Accordion, Alert, Skeleton, Pagination and chart
primitives. Keep `FlowmarkMark` and the wordmark accent dot.

Use a Card for one coherent data panel. Open sections and metric strips can use
semantic HTML and structural dividers. Workflow summaries, result highlights,
run lists and Overview composition belong to `apps/dashboard`.
`RunSnapshot` is a shared product presentation for identity/status, results,
milestones and payload inspection. The dashboard owns the projection from recorded
events. This component performs no fetching and owns no SDK, API, persistence or
business-outcome classification. Add a primitive
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

## Product landing direction

The landing presents the complete Flowmark product vision through discovery,
observation, understanding and continuous evolution. Keep charcoal, the Flowmark
mark/accent dot, system fonts, lime actions and restrained lavender emphasis.
The public site is dark-only; authenticated surfaces retain existing themes.

Use oversized editorial typography, short explanations, structural rules and
purpose-built visualizations. The hero is an open application topology with moving
signals and a selectable missing-confirmation scenario. It has no dashboard chrome.
Discovery converges code paths into a process; a vertical journey connects separate
executions; an outcome dot field compares historical populations; a review loop
connects code changes, agents and evidence. People, agents and tools share a final
connected evidence diagram. Avoid repetitive grids of feature cards.

Keep business outcomes, execution behavior and evidence quality separate. The
outcome illustration uses 100 dots representing seven bookings each: 92% before
and 76% after the illustrative release. Health rings preserve the distinct
execution and field-coverage measures. Expose denominators, observation windows
and tabular values; association does not establish causality.

Product illustrations are local and synthetic. They do not connect repositories,
run tests, publish definitions or establish deployed capability. Three independent
instrumentation entrances remain explicit; candidate meaning requires human review.
Preserve unknowns and distinguish execution completion from later confirmations.

Static narrative stays server-rendered. Local selection state and motion policy
belong to small client components. Reuse shared Button, Input, Sheet and Accordion.
Diagram nodes use accessible buttons with selected/expanded states. Code and tables
scroll within bounded containers; layouts reflow at 320 px without page overflow.

Aceternity's Background Lines, Tracing Beam, Timeline, Glowing Effect and Moving
Border informed the visual direction. Existing attributed beams and spotlights
remain; original SVG signal trails, node activation and scroll traces communicate
relationships. Native CSS handles frames, with no per-frame React updates or new
animation dependency. A shared preference subscription and viewport observers
suspend offscreen/hidden scenes. Reduced motion defaults to static diagrams;
explicit Play motion opts into scene loops, and Pause motion stops animations.
Finite entrances, hover movement and scroll traces remain motion-safe. Unsupported
view timelines render their complete path. Anchor scrolling respects reduced motion.

**Join the Waitlist** is the primary conversion in the header, hero and closing.
The closing email form uses the existing endpoint, preserves loading and explicit
failure states, and acknowledges success only after the API confirms it. Avoid
competing public signup or Studio-launch actions. Documentation and source remain
quiet secondary resources.

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

Studio search is project-scoped and keyboard accessible. Show processes, runs
and enabled exact business references as distinct result groups; do not imply
arbitrary property or entity search. A process or reference opens its cohort in
Explore, retaining status, time and result predicates. Exact references stay
qualified by process and field, and repeated matches offer one cohort entry.
Single-run results retain a return link to Explore. Keep this workspace search
distinct from the inline text filter over the current run list. Selecting a
search result and clearing Explore create history entries; incremental typing
replaces the current entry. A project change discards the open search and its
pending text, and cached search results are keyed by project.

From Explore, a run opens in a right-hand inspector over the mounted cohort.
Use the shared Sheet for focus management and narrow screens. Native history
updates keep the ordinary `/runs/:id` URL without replacing the Explore page;
direct loads and Open full page use the existing full run page. Evidence modes,
peer selection and linked-run navigation replace the inspector's history entry,
so Close/Escape/back return to the original cohort, cursor page and row focus.
Keep all evidence modes available on mobile. Reuse `RunDetailContent` and
`RunInvestigation`; project changes discard the panel and scoped URL state.
Detail, relationship, comparison and expectation queries stay project-keyed.

Authentication pairs a focused form with the product story. Setup uses a
five-step rail, compact mobile progress, a distinct content panel and real
loading/error states. Each step change focuses its heading. Code panels use the
shared copy controls and the validated API origin. Existing-key evidence does
not mean the application is installed, and copied instructions never mean an
agent is connected. The completed user's setup guide is a local walkthrough,
not a reset of their saved onboarding state.
