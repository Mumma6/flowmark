# ADR 0009: Minimal versioned run investigation selection

- Status: accepted for the implemented run handoff
- Date: 2026-11-08
- Task: Product TASK-001.1

## Decision

Use `RunInvestigationSelectionSchema` in `@flowmarkdev/core` for the smallest
selection already consumed by Studio and MCP:

```json
{
  "version": 1,
  "kind": "run",
  "projectId": "00000000-0000-4000-8000-000000000001",
  "runId": "00000000-0000-4000-8000-000000000002",
  "section": "events"
}
```

The project and internal run identifiers are UUIDs. Section is `events`,
`related`, `expectations` or `operations`; optional cursor is at most 2048
characters and optional limit is 1–100. `decodeRunInvestigationSelection` rejects
unknown fields, versions and modes. `runSelectionToolInput` maps validated data
to existing `get_run` input and preserves the exact cursor/limit.

Studio's `studioRunSelection` exports the first events page from the run handoff.
The local protocol reference test serializes that actual adapter's selection and
compares authorized MCP summary/events with the same account's Studio API reads.

## Boundaries

The selection contains no credentials or permission. Each destination independently
checks its session or delegated grant, membership and explicit project. It is a
live read, not a snapshot. Cohorts, period windows, revisions and peer comparison
are explicitly unsupported in version 1; they are rejected rather than dropped.
Existing manual evidence exports and analytics semantics remain unchanged. This
is not a general query language, saved object or public read SDK.

## Period cohort

A separate `PeriodCohortSelectionSchema` (`kind: "period"`) carries one technical
period: a workflow and two absolute UTC windows. `decodeRunInvestigationSelection`
still rejects `kind: "cohort"` and extra fields such as revision or environment.
`periodCohortToolInput` maps a valid period to `get_workflow_insights` mode
`technical`. The previous window is part of the question. A return link preserves
the current window as Explore filters; it does not switch projects or freeze the
evidence. Two reads are separate observations.

Studio handoffs preserve an accepted linked section, cursor and page limit in
both tool arguments and return URLs. Expectations use the same bounded paging
contract as events, operations and related runs. A damaged or foreign selection
produces no connected call. Changing the run/project/selection resets local
inspector state through React identity, including browser back/forward.
