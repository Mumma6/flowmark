# Business evidence

Business readers investigate application-reported results without receiving raw
project diagnostics. Owners invite them through **Settings → Project access** and
choose **Business reader**. Existing diagnostic viewers retain their full access.

## What readers can see

All project workflows, internal run references, reported status/outcome codes,
start times, recorded durations and activity counts are visible. This is
project-wide access: customer references are search filters, not customer-level
permissions. Only invite people who should see this metadata across the project.

Results and reference values start unpublished. In **Settings → Project access →
Business evidence publication**, the owner selects:

- Specific declared result paths for an exact immutable workflow revision. Counts
  and closed category/reason vocabularies are eligible; free-form strings are not.
- Declared reference keys for specific workflows. Publishing a key permits reading
  all reported values of that key, including searching and following journeys.

Publication includes selected labels and vocabularies. A later result revision
requires a separate selection. Unknown categories, invalid types and missing
values appear as unavailable evidence rather than leaking raw values. Numeric
aggregates also require the declaration's aggregate permission.

External run IDs, unpublished properties/results, errors, operations, raw events,
expectation payloads, release and environment diagnostics remain withheld.
Technical filters and unsupported saved selections fail explicitly.

## Investigating

Studio presents published meaning, activity pages, projected run results,
reference journeys, result comparisons and recorded peers. A run may be saved as
a private live selection: reopening it checks current membership and publication.
The owner can preview the business view from publication settings.

The API's `businessEvidence` reads and the existing MCP tools use the same
projection rules. MCP technical modes remain unavailable to business readers.
Portable run views refresh through the current authorized tool call. Copying
published evidence exports only that projection; downloaded copies cannot be
revoked and do not prove current access.

Every server read checks current project membership or its independent read-key
credential. Delegated reads also check the live agent grant. Owners replace a
publication using its current revision; stale edits fail. Paging cursors are bound
to the project, selection and publication revision. Restricting publication makes
old cursors unusable. A response already delivered remains a past observation.

Completed is a reported terminal state, not proof that every record succeeded.
Missing telemetry establishes neither liveness nor failure. Comparisons show
reported observations and coverage, not verified correctness or causality.

## Bounds and rollout

Publication supports up to 25 workflow/revision selections with 12 result fields
each, and 25 reference namespaces with 10 keys each. Owner configuration currently
requires at most 300 result declarations and 300 reference definitions per project.
Responses are capped at 256 KiB; activity pages at 50 runs and overview at 100
workflows (exact workflow selection remains available). Larger selections fail
explicitly or show their continuation bound.

Migration 0028 adds the role, invitation access level and publication table. Follow
[database rollout](migrations.md): disposable local/CI verification, approved
Preview validation, then the activated migration-before-deployment pipeline.
Deploy all enforcing readers together. Older binaries must not serve projects
with business memberships. Project erasure cascades publication; reader account
erasure detaches that membership while preserving the owner's evidence.
