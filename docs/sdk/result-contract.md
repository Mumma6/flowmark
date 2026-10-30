# SDK outcome and report contract

This contract was established in TASK-001. TASK-004 implements terminal outcomes and TASK-010 implements reports in source;
TASK-013 typed definitions remain proposed. Availability in published packages
is tracked separately through the SDK release process.
The executable synthetic references live in
`packages/sdk/test/result-contract.test.ts`; they are not runtime exports.

## Independent facts

Execution status remains `completed` or `failed`. A completed import can have a
`partial` outcome; a booking that legitimately finds no availability can complete
with `unavailable`. A failed CRM sync can still report committed updates. Neither
status nor outcome verifies business correctness.

The terminal calls are `done({ outcome?, result? })` and
`fail({ code, outcome?, result? })`, retaining existing failure fields and marker
lifecycle behavior. The terminal event's top-level `outcome` is the only canonical
business outcome. Codes are case-sensitive ASCII identifiers matching
`^[a-z][a-z0-9_-]{0,63}$` (1–64 characters). Reject invalid values through existing
instrumentation diagnostics, without throwing into application work. No trimming,
case conversion, inferred outcome, or default success code is permitted.

An absent outcome means unreported; an absent result means unknown, not zero,
empty success, or a copy of the last report. An explicit empty result `{}` is a
reported empty object. `null` is not a valid result object. Both results and
reports reuse the existing bounded JSON object limits: five nested levels, 128
keys, 128-character keys, 2,048-character strings and 16 KiB encoded bytes.

Only the top-level terminal `outcome` defines the business outcome. Fields inside
`result` are ordinary application data. There are no outcome mappings, inferred
outcomes or reserved default declaration revisions.

## Absolute reports

`flow.report(snapshot)` records an absolute, non-final business result
snapshot. It neither closes a run nor changes progress, context, or final result.
Every accepted report replaces the entire previous snapshot, including nested
objects: omitted fields become unknown, rather than retaining earlier values.
Zero is explicit zero; omission is unknown. Counts describe application-reported
committed work at that observation, not predicted completion or unique entities.

TASK-010 uses a distinct `report` event with a `result` object and the
existing event timestamp and envelope event ID. Use persisted event order, not
client timestamps, to choose the latest accepted report. Duplicate envelope IDs
must not advance that order. No new caller-controlled revision field is needed;
ordering follows the existing append-event boundary. Clock skew cannot reorder
snapshots. This does not settle cross-request terminal conflicts (TASK-003).

Reports obey the existing handle's terminal lifecycle; calls after a terminal
request are ignored, including while completion waits for open operations.
Earlier reports remain historical evidence after termination. The final result
is supplied explicitly and can differ from a report: a final reconciliation may
use a corrected denominator or scope. A lower number alone proves neither rollback
nor data loss. Interrupted reporting leaves a last observation, not proof that a
run is still active or failed. A callback checkpoint likewise proves no liveness.

## Five synthetic scenarios

These fixtures describe possible application behavior, not observed adoption.
Application code performs all work, retries and callbacks itself. Report progress
per batch/page, never per individual item solely for telemetry.

1. **Customer import:** 10,000 input rows; 9,600 imported, 300 skipped duplicates,
   100 rejected invalid addresses. `done({ outcome: "partial", result })` is a
   technically completed run. Unit is input rows; these categories partition this
   particular input, and reason codes are `duplicate` and `invalid_address`.
   A clean variant reports 10,000 imported and outcome `complete`.
2. **CRM sync:** after two committed pages, report 400 updated records out of 600
   expected. A provider timeout leads to `fail({ code: "CRM_TIMEOUT",
outcome: "partial", result: { updated: 400, expected: 600 } })`. These are
   update operations, not necessarily distinct customers. Page retries belong to
   the application, and must not silently inflate the declared count.
3. **Booking:** a legitimate inventory miss ends with
   `done({ outcome: "unavailable", result: { reserved: 0, requested: 1 } })`.
   An accepted request awaiting callback only records `step("awaiting-callback")`;
   no terminal result or expectation API is invented here. The application
   persists and propagates the run ID to its authorized callback.
4. **Recurring reconciliation:** each scheduled application invocation gets a new
   run ID. Report `{ checked: 200, mismatches: 3 }`, then `{ checked: 400 }`;
   mismatches are now unknown. If the process disappears, final result stays
   absent. Checked counts are ledger entries for this invocation, not customers.
5. **Customer investigation:** use an opaque synthetic case reference in start
   properties and safe category `channel: "support"`. A technical completion
   without a result stays unknown. A separate explicit empty result stays empty.
   Neither can be interpreted as zero affected customers or a resolved case.

Safe dimensions are bounded categories such as provider, channel and region;
opaque case/batch references are lookup identifiers, never grouping dimensions.
Do not include names, email addresses, credentials or raw customer records.
Reason taxonomies must be bounded workflow-owned codes, not exception messages.

## Proposed typed examples — unavailable until TASK-013

```ts
interface ImportContext {
  batchRef: string
  provider: "crm-a" | "crm-b"
}
interface ImportResult {
  imported: number
  skipped: number
  rejected: number
  inputRows: number
}

const imports = flowmark.defineWorkflow<
  ImportContext,
  ImportResult,
  "complete" | "partial" | "rejected"
>("customer.import")
const flow = imports.start({
  properties: { batchRef: "synthetic-batch-1", provider: "crm-a" },
})
flow.report({ imported: 6000 })
flow.done({
  outcome: "partial",
  result: { imported: 9600, skipped: 300, rejected: 100, inputRows: 10000 },
})
```

Definition creation is inert, emits nothing and runs no callback. `.start()`
reuses existing lifecycle and delivery. Context types constrain start properties
and partial context amendments; result types constrain final results and partial
reports; outcome types constrain terminal codes. The untyped marker API stays
available. Generic types are compile-time guidance, never uploaded declarations
or a substitute for server validation. TASK-013 must test inference and rejected
invalid calls without requiring consumers to add index signatures.

TASK-004 implements minimal bounded result declarations. Use a workflow-owned
`definitionRevision` to version outcome vocabulary, field meanings, units,
denominators, reason codes and categorical dimensions; this is distinct from the
application release and from snapshot ordering. A semantic change requires a new
revision; absent revisions remain undeclared data. Do not aggregate across
incompatible revisions. No universal reconciliation equation applies: the import
fixture partitions rows, whereas CRM counts operations and recurring checks count
ledger entries. The declaration format uses immutable revisions, ordered field paths/labels,
count/category/reasons kinds and optional units, without treating
TypeScript generics as runtime metadata.

## Source evidence and rollout

At TASK-001, inspected SDK types, core event/JSON schemas and local business-harness source
already supported bounded terminal results, batched progress, handled errors and
application-owned operations. Canonical outcomes and reports were not yet exposed; TASK-004 and TASK-010 now implement them in source.
The harness is synthetic; no external customer source or adoption was validated.
Real-workflow feedback is a later learning opportunity, not a dependency.

TASK-001 changed no runtime exports, wire payloads, storage or package versions.
TASK-010 adds report events and migration 0010 (event enum and persisted receipt
sequence); run-scoped transactional locking orders accepted appends against
terminal markers. Read APIs identify the latest report separately from final results.
Existing rows receive sequence values during migration; they contain no reports
and their historical meaning stays unchanged. The additive bigserial column may
rewrite/lock the event table during migration; verify duration in Preview before
merging. No backfill of business data, retention change or new service is required.
For new wire capabilities, apply the migration and deploy ingestion, persistence
and readers before enabling writers. Verify the stored value end to end. Do not
add fallback representations or promote reports into final results. Publishing,
deployment and exact release versions require separate release coordination.
