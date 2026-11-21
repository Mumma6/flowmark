# Process health read

`workflow.processHealth` is a Studio tRPC read for one observed workflow in the
authorized project. It uses exact workflow identity. Retries with new run IDs
count as separate runs. Changing the workflow name starts a separate selection.

Diagnostic project readers can request the assessment and its evidence. Each
call, including a continuation, rechecks current authority. Business readers
continue to use the [published evidence projection](./business-evidence.md) for
reported measures. That projection withholds the diagnostic expectation signal,
its count and its declaration identities.

## Selection and assessment

Supply `workflow`, the exact declared `expectationName`, and a `window` with
canonical UTC `startedAfter` (inclusive) and `startedBefore` (exclusive). An
optional `baseline` uses the same shape and ends at or before the current window
starts. Each window is at most 31 days. The read rejects unsupported filters,
including release, environment, dimensions and cross-workflow composition. An
unobserved workflow returns `unsupported-scope`. An observed workflow with no
mature declarations in the window returns an assessment with `zero-denominator`
attention.

The `observed-workflow-health-v1` method returns three dimensions using the
same run cohort in each window:

- **Execution** counts completed runs, failed runs and runs without a reported
  terminal state. It uses compact run facts with the same status and revision
  rules for raw fallback.
- **Reported business outcomes** groups the labels reported on runs and counts
  runs missing a label. These application-reported labels carry units of runs.
  A completed run and an expectation settlement make separate observations.
- **Evidence quality** includes observed definition revisions and runs without
  an effective declaration of the selected name. It counts settlement-only
  projections, unavailable projected evidence and declarations of other names
  separately. Intended declaration coverage is unknown. Missing or expired data
  can limit what the retained population supports.

The expectation denominator is the selected retained effective declarations
whose deadlines are strictly earlier than the server observation time.
Each mature declaration contributes exactly once as overdue, met on time or met
late. An unsettled declaration at the exact deadline is pending. An early
settlement can already be met on time while the declaration remains outside the
mature denominator. Cancelled declarations, settlement-only projections and
unavailable evidence contribute zero to the denominator. A run with two overdue
declarations contributes two records.

A mature overdue count above zero triggers attention. With a nonzero mature
denominator and zero overdue declarations, attention is `quiet`. The optional
comparison returns `zero-denominator`, `incompatible-revisions`, or
`thin-history` when it lacks support, checked in that order. Comparable
periods have one matching observed revision each (including two legacy cohorts
with no reported revision) and at least five mature declarations each. They
return an overdue-rate difference in fractional units. This is a descriptive
comparison of retained observations.

## Evidence, observation and limits

The default `evidence` selection pages overdue declarations. Set it to `mature`
for every contributing record in the denominator. The page includes the exact
total, scoped run IDs, declaration identities, deadlines, states and an optional
`nextCursor`. Pass `runId` and `expectationId` to
`run.expectationsPage` to inspect exactly that retained declaration under
current diagnostic authority. An exact selection does not accept a cursor.
The default page size for the health evidence list is 25, with a maximum of 100.

Each call reads a new database snapshot and stamps it with a single server
`observedAt` used for classification. Pass `nextCursor` as `cursor` with the
same selection to continue. To reopen from the first page, pass the original
`observation` as `previousObservation`. Both continuations are bound to the
project, workflow, expectation, windows, method and evidence selection. If the
retained assessment population changes, including late settlement or a
declaration crossing its deadline, the response is `refreshed` and starts at
the first page. Discard the earlier pages in that case. With stable inputs it
is `unchanged` and successive pages reconcile to the total. Observation
tokens identify evaluated populations for refresh detection. Reads always
resolve against current authority and retained evidence.

A read admits up to 2,000 runs, 10,000 expectation projections and 20,000 raw
fallback events across both windows. The assessment statement has a five-second
timeout. Exceeding a budget fails the request with `BAD_REQUEST` and a reason
to narrow the window. No partial totals are returned.
