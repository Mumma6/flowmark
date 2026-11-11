# Qualified reference journeys

The internal `workflow.journey` tRPC query follows recorded parent and retry
links for one exact business reference in the reader's authorized project.
It returns compact run evidence for Studio's reference journey view.

## Follow a journey in Studio

Use Studio search to find an exact declared business reference, then open its
reference result. Explore retains its run filters while the journey opens above
the execution list. You can also choose **Follow this reference** from an exact
lookup selection in Explore.

Choose each linked process and its declared lookup field, then select
**Follow linked evidence**. The starting namespace is fixed to the exact
reference you opened; additional namespaces are explicit choices. When multiple
starting executions match, Studio asks you to choose one.

Each execution shows its recorded status and application-reported business
outcome. Open **Reported results** or **Confirmations** in the existing inspector;
closing it returns focus to the journey and keeps loaded pages and Explore
filters. Retries are separate executions. A later confirmation remains separate
from the execution's terminal result. Supporting parent/retry links can be opened
without declaring their runs members of the selected reference.

Use **More linked executions** or **More starting executions** to continue.
Studio retains at most four 25-record pages; an ambiguous chooser shows the latest
loaded pages once that limit is reached. Errors hide unavailable evidence and
offer retry; they never stand in for missing business activity. **Edit reference
mapping** restarts selection. Journey URLs are scoped to the current project and
cannot select another project or grant access. Explore filters below the journey
do not constrain its independently selected reference.

## Select the reference explicitly

```ts
const query = {
  workflow: "patient.match",
  key: "referralRef",
  value: "REF-1042",
  namespaces: [
    { workflow: "patient.match", key: "referralRef" },
    { workflow: "appointment.book", key: "referralRef" },
    { workflow: "notification.dispatch", key: "referralRef" },
  ],
  limit: 25,
}
```

Every mapped workflow must declare its selected key as a `lookup` field. An
undeclared property or a `dimension` field cannot establish membership. There
may be one selected key per workflow, with at most eight workflow namespaces.
Mappings can explicitly select different key names in different workflows.

For the fictional Meridian referral family, a matching run may link to a booking,
its retry and a notification. They must all carry the selected reference through
the explicit mapping. A shared `referral.ingest` batch parent remains supporting
context; it does not pull other referrals into the journey. Equal strings in an
unmapped workflow, another project or an unlinked run do not join the journey.
Correlation IDs alone are not traversed.

## Selection and supporting evidence

- `NotFound`: no anchor matches the workflow/key/value selection.
- `Ambiguous`: multiple anchors match. Inspect `candidates` and
  `nextCandidateCursor`, then send a matching internal `anchorRunId` to choose
  one. Results are never silently merged into an entity.
- `Selected`: `nodes` contain internal and external run IDs, workflow, start
  time, link depth, recorded execution status and application-reported outcome.
  `edges` identify parent/retry evidence and distinguish journey membership
  from supporting context.

Parent IDs in existing telemetry are not workflow-qualified. A parent link is
traversable only when its external ID resolves uniquely across the project.
Missing and ambiguous parents remain explicit; ambiguous parent candidates are
bounded to two. Retry identities use their existing workflow/run ID namespace.
Retries remain separate runs.

`Running` means no terminal event was recorded; it does not establish liveness.
Completed execution and application-reported business outcome remain separate.
Meridian downstream evidence is sampled: these results are not a conversion
funnel or proof that absent work did not happen. Existing run expectation reads
remain available independently; this query does not reinterpret their deadlines.

## Bounds and continuation

Traversal is bounded to four link hops and 100 matching runs before metadata
projection. Each response contains at most 50 nodes (25 by default). SQL limits
each frontier and reads compact facts without loading event or result histories.
`bounds.traversalTruncated` reports additional reachable evidence beyond the
depth/node budget, and `bounds.cycleDetected` describes the bounded graph.

Continue nodes with `nextCursor` in `cursor`, keeping the same selection and
anchor. Continue anchor choices separately with `nextCandidateCursor` in
`candidateCursor`; do not combine candidate and node continuations. Cursors bind
the project, workflow, key, value, ordered namespace mapping and selected anchor
where applicable. Foreign, changed or invalid selections are rejected.

Reads are live rather than frozen snapshots. Concurrent telemetry or declaration
changes can alter the bounded component or invalidate continuation; restart the
selection when rejected. The 100-node budget cannot be bypassed by paging.

## Code boundaries

`@flowmarkdev/core` exports `ReferenceJourneyQuerySchema`,
`ReferenceJourneyQuery` and `ReferenceJourneyPage`. `WorkflowStore.referenceJourney`
owns SQL through the database persistence boundary.
`GetProjectWorkflowData.referenceJourney(reader, query)` authorizes the project,
validates input and delegates through `WorkflowRepository`; `apps/server` exposes
the existing authenticated tRPC shell. No new public REST or MCP tool is added.
No schema migration, graph service, execution engine or SDK publication is needed.
