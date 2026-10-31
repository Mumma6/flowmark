# Reported business outcomes over time

Business insights are descriptive application reports, never independently
verified correctness, unique entities or causal regression detection. Technical
completion/failure metrics keep their existing meanings and denominators.

## Definition and cohort

Select one workflow, immutable definition revision and explicitly aggregatable
field. New declaration fields can use `aggregate: true`; existing declarations
remain presentation-only. Counts accept nonnegative safe integers. Categories
and reason maps require a distinct vocabulary of 1–20 strings in `values` when
aggregation is enabled. A new meaning, unit or vocabulary requires a new revision.
No legacy result-to-outcome mapping or automatic field inference is introduced.

Only `properties.definitionRevision` on the original accepted start selects a
revision. Context amendments do not change it. Start-cohort dimensions use the
current persisted run context and only configured bounded dimension keys/values;
they do not attribute that context to earlier operations.

Each current/previous interval is at most 31 days, uses canonical ISO UTC
millisecond timestamps, and is half-open: start >= after and start < before.
The UI defaults to seven days versus the preceding seven. Each persisted
workflow/run identity counts once. Envelope retries are idempotent; new attempts
with new run IDs count separately. Terminal events arriving later update the
original start cohort. These are observations as of the read, not frozen reports.

## Populations and unknowns

Canonical outcome counts use all finished runs in the cohort, irrespective of
result revision; missing outcomes and counts outside the top 20 are explicit.
Field totals use only finished runs with the selected original-start revision.
Failed runs with valid results contribute business evidence while remaining
technical failures. Open/no-terminal runs and all non-final report snapshots are
excluded from final totals.

Coverage partitions the finished population into known field observations,
incompatible/missing revisions, missing terminal results, absent fields, wrong
types and unknown categories. JSON null is a wrong type, not a known zero.
Category strings outside the vocabulary are unknown. A reason map is known only
when every present value is a valid count and every key is declared. An absent
reason key is unknown, not zero: each reason has its own observed-run count and
nullable sum. Empty maps do not invent count observations. Count/reason sums
are exact decimal strings; no observations produce null, explicit zeros produce
"0". Overlapping reasons can count the same reported item more than once.

Ratios use the sum of an explicitly selected aggregatable numerator divided by
the sum of an explicitly selected aggregatable denominator over the **same
jointly valid finished runs**. For example, 1/2 and 9/100 yield 10/102, not the
average 29.5%. Missing or wrong-type members exclude the pair; zero-denominator
runs contribute their explicit values to totals, but an overall zero denominator
or no jointly valid pairs yields an unavailable ratio. A ratio can exceed one;
Flowmark does not infer its business meaning or call it a success score.

Daily rows use the same UTC start cohorts and field coverage. They show observed
cohort dates; missing dates/fields are not silently zero-filled. Count/reason
trends are sums of reported items across runs, not distinct customers or records.

## Evidence, comparison and limits

The workflow view links canonical outcomes and declared categories/reasons to
historical Run Explorer results. Evidence preserves workflow, exact half-open
period, dimension, selected revision where applicable, release and result
selection. Count predicates support eq/gte/lte; category predicates support eq;
reason predicates select one declared reason count and require the entire map to
meet the same coverage rules as aggregation. Paths and operators are checked
against the scoped declaration before parameterized SQL is built. Total and
cursor pages use the same population, including history beyond the latest 100.

Two selected releases are compared within the current period and selected
definition. Both need at least five known selected-field observations, and five
jointly valid ratio observations if a ratio is selected. Any finished run with a
missing/different revision makes comparison unavailable. Coverage stays visible
when comparison is unavailable. Differences are descriptive; five observations
are a display threshold, not statistical significance or evidence of causation.

Responses contain at most four scopes (current, previous, two releases), 20
outcomes plus an explicit omitted bucket, 20 configured categories/reasons and
at most 32 UTC dates per scope. No raw event/identifier array is aggregated into
the response. Persistence restricts workflow/project/start windows before event
aggregation. Historical filters keep the existing 100-row maximum page size.
No schema migration, compact-fact storage, batch ingestion protocol or SDK
runtime change is required.

Count totals link to valid nonnegative selected-field observations. Ratio totals
link through `ratioSelection: { revision, numerator, denominator }`, requiring
both count paths to be jointly valid in the same finished run. Those evidence
pages preserve the same exact period/dimension/release selection.
