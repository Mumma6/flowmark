# ADR 0013: Compare explicitly linked execution evidence

- Status: accepted by maintainer on 2026-11-12
- Date: 2026-11-12
- Tasks: Product TASK-009.1–009.4

The maintainer explicitly approved this proposal with “Approve the comparison
contract.” Implementation and local feature verification are authorized; hosted
operations, merge and deployment remain separate.

## User question

For a selected upstream process, how did the downstream application's reported
result ratio change between two periods, among unambiguously linked executions?
For example: matching attempts → appointment booking, comparing reported
`confirmed / requested` counts for an explicitly selected provider and optionally
two booking releases. Existing per-workflow analytics cannot select booking
evidence by its upstream execution's start window and provider.

## Exact population

Each retained upstream execution starting in the half-open UTC window is one
anchor. Retries remain separate attempts. Select two distinct workflow names,
an explicit revision for each, and two declared aggregatable downstream count
paths. An optional dimension/value filters the upstream process and must be
configured there. Windows are chronological, nonoverlapping, positive and at
most 31 days each. No implicit environment or unsupported filter is accepted.

Only a **direct application-reported parent link** is used: the downstream
`parentRunId` equals the anchor's external run ID within the same project. That
external ID must resolve to exactly one retained execution across the project,
so another workflow reusing it makes the link ambiguous. Correlation, equal
business-reference values and transitive links do not create pairs.

Count all linked executions of the selected downstream workflow before
filtering revision, status, release or metric. Zero means no retained linked
execution, not proof it never happened. Two or more means ambiguous attempts;
do not select the newest, deduplicate customers or sum all retries. The sole
downstream execution may start outside the upstream window; it belongs to the
anchor's window. Optional distinct releases select the sole downstream
execution's release A in the previous window and B in the current window.

## Coverage and arithmetic

Classify each anchor exactly once, in this priority order: incompatible/missing
upstream revision; ambiguous parent identity; no retained downstream run;
multiple downstream runs; selected downstream release mismatch;
incompatible/missing downstream revision; downstream without terminal evidence;
missing final result; missing selected count; invalid count; known pair.

Known pairs have final application-reported counts on both paths: nonnegative
safe integers. A failed execution can still carry a valid final business result;
technical failure is also reported separately. Intermediate reports do not
substitute for final results. The ratio is **sum(numerator) / sum(denominator)**
over the same known pairs, never an average of percentages. Exact integer sums
are decimal strings; a zero denominator yields unavailable, not zero percent.
Ratios are not clamped or asserted to be correct business results.

For example, a previous window has 12 anchors: ten known pairs report 50/100,
one has no retained child and one has multiple children. The current window has
14 anchors: six known pairs report 45/60, two have no child, and one each has an
incompatible upstream revision, ambiguous parent identity, multiple children,
release mismatch, incompatible downstream revision and no terminal evidence.
The reported ratios are 50% and 75%; known-pair coverage is 10/12 and 6/14.
The arithmetic difference is +25 percentage points, but comparison availability
is **incompatible** because the current cohort includes revision mismatches.
If those mismatched anchors use compatible revisions instead, their downstream
evidence is classified normally and availability is recalculated.

Show each window's recorded ratio/counts/coverage independently. A comparative
delta requires at least five known pairs in each window, nonzero denominators
and no upstream/downstream revision mismatches. Missing links/metrics remain
visible excluded evidence; any available comparison describes known recorded
pairs only. No causal claim, unique-customer conversion or exhaustive funnel is
inferred from Meridian's sampled downstream instrumentation.

## Read and UI boundary

Implement project-authorized aggregate and cursor-paged contributing-anchor
reads through the existing API/persistence layers. Both use the same SQL
classification/population. Evidence can filter a coverage class and must match
aggregate counts beyond 100 anchors, with stable start-time/internal-ID cursors.
Each record names its anchor and, only when unambiguous, the downstream run;
open either in the existing inspector and preserve the complete return query.
All queries have finite page/read budgets and retained-history caveats. Reuse
compact run facts and event fallback for unbackfilled retained runs.

Add a focused comparison in existing Insights, with explicit windows, revisions,
paths, optional upstream dimension and downstream releases. Keep unsupported,
thin, missing, zero-denominator, error and empty states explicit. This proposal
adds no execution feature, entity identity, telemetry migration, dependency,
retention extension, hosted operation or new MCP tool. External clients do not
gain an unimplemented comparison mode through a fabricated handoff.
