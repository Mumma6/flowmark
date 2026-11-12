# Compare linked process evidence

Open **Insights → Linked process comparison**. Choose an upstream workflow and
revision, a downstream workflow and revision, two declared aggregatable count
paths and two nonoverlapping UTC start windows. Optionally select a configured
upstream category/value and two distinct downstream releases. Analyze, inspect
the coverage counts and open the contributing attempts in the existing run
inspector. Returning to Insights preserves the complete selection and evidence
page in the URL. A recipient of that URL still needs project access.

For Meridian, a useful question is how appointment bookings' reported
`confirmed / requested` counts changed among executions explicitly linked to
`patient.match` attempts for a provider. **Use Meridian fields** fills the field
selection; choose dates covering the actual retained dataset. It creates no
telemetry. Per-workflow booking analytics cannot select this population by the
upstream matching attempt's start window and provider.

## What the denominator means

Every retained upstream execution in a selected half-open start window is one
attempt, including application-owned retries. An optional category applies to
the upstream properties and must be declared there with the selected value.
The two workflow names must be different; both revisions are explicit.

A pair requires a direct `parentRunId` from the selected downstream workflow
to the anchor's external run ID. That parent identity must resolve to exactly
one retained run across the project. A reused external ID in another workflow
therefore makes it ambiguous. A matching reference value, correlation ID or
transitive link does not create a pair. The downstream run may start outside
the upstream window; it belongs to its anchor's window.

All retained direct children of the selected downstream workflow are counted
before checking release, revision, status or metric. With two or more, no child
is chosen and the attempt is classified as ambiguous. Selecting a release does
not turn multiple children into a unique pair. Missing children mean no retained
linked evidence; the application may have worked without reporting a link.

Each anchor is classified once, in this order:

1. Missing/incompatible upstream revision.
2. Ambiguous retained parent identity.
3. No retained downstream execution.
4. Multiple downstream executions.
5. Sole downstream execution has another selected release.
6. Missing/incompatible downstream revision.
7. No downstream terminal evidence.
8. Missing final business result.
9. Missing selected count.
10. Invalid count type/value.
11. Known recorded pair.

Known counts are nonnegative safe integers from the final result. A technically
failed run can report a valid final business result; its failure is shown
separately. Intermediate reports do not replace final results. The ratio is
**sum of numerators / sum of denominators over the same known pairs**. It is
never an average of percentages, an exhaustive funnel or a unique-customer
conversion rate. Integer totals remain exact decimal strings even beyond
JavaScript's safe integer range. A zero denominator produces unavailable.

Both windows retain their own totals, ratios and coverage. A comparative
difference requires at least five known pairs per window, nonzero denominators
and no classified revision incompatibilities. Empty, thin and incompatible
baselines have explicit messages. Missing links/metrics remain visible even
when enough known pairs support a descriptive comparison. Release associations
and reported business results do not establish causality or verified correctness.

For example, known pairs reporting 1/1 and 0/9 contribute 1/10 = 10%, rather
than an average of 100% and 0%. A later comparison to 50% is a −40 percentage
point difference among those recorded pairs. Excluded attempts are shown beside
that figure, so a change in sample coverage remains visible.

## API and shared selection

The existing session/read-key project boundary exposes two tRPC queries:

- `workflow.linkedComparison`: input is `LinkedComparisonQuery`; response is
  `LinkedComparison`, including both windows, classification counts, exact sums,
  ratio availability, actual declared field labels, bounds and retained-evidence
  caveat.
- `workflow.linkedEvidence`: input is `{ query, scope, coverage?, cursor?, limit? }`.
  `scope` is `current` or `previous`; `coverage` is one of the named classes in
  `LINKED_COVERAGE`; page limits are 1–50, default 25. The response contains
  `rows`, the complete selected class `total`, `nextCursor`, bounds and caveat.

GET requests use `/api/trpc/<procedure>?input=<URL-encoded JSON>`. The project
comes from verified read credentials or the authenticated user's selected
project. Unsupported filters, partial dimension/release pairs and undeclared
count paths are rejected rather than dropped. Ingestion credentials gain no
read or management permission. No new SDK method or MCP analysis mode is added.

`@flowmarkdev/core` exports `LinkedComparisonQuerySchema`,
`LinkedEvidenceQuerySchema`, `LinkedComparisonSelectionSchema`, the read models
and `linkedComparisonAvailability`. Selection version 1 has kind
`linked-comparison`, `projectId`, `query` and optional `evidence` scope/class/cursor.
It contains a live question, not captured evidence or credentials. Existing run
and technical-period selection formats are unchanged.

Aggregate and evidence use the same SQL classification over the full retained
population, including more than 100 attempts. Evidence has stable upstream
start-time/internal-ID pagination; SQL microseconds survive the cursor. Cursors
bind the project and complete comparison/class selection, and their anchor must
still belong to that selection. Foreign, forged or removed anchors require
restarting paging. A refreshed read can observe later telemetry or retention
changes, so aggregate and evidence reads are not a shared historical snapshot.

## Cost and retained-history limits

Each window is at most 31 days and 10,000 retained upstream anchors. Parent and
child ambiguity lookups read at most two candidates. Existing compact facts are
used when available; complete retained-event fallback is allowed for at most
100,000 events across the selected runs. Above either population budget, narrow
the selection: the API returns an error rather than a partial aggregate. Reads
use a read-only repeatable-read transaction and a 5-second statement deadline.

Retained history is not an archive. Missing runs, links, terminal events or
results do not prove that application work never happened, is active or failed.
This feature does not extend retention, backfill facts, change telemetry or
operate the application's work. The accepted rules are in
[ADR 0013](decisions/0013-linked-execution-comparisons.md).
