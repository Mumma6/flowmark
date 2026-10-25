# SDK Semantics Review

> Reviewed October 25, 2026 against the local invoice-import scenario and the
> PostgreSQL-backed API/dashboard flow. This documents current behavior; it
> does not propose a public SDK redesign.

## Recommendation

Keep the current run-centered API for the next validation step. The invoice
scenario is instrumented with ordinary calls and the persisted evidence answers
the intended run-investigation questions. No new SDK concept or lifecycle
change is justified by this exercise.

## Current semantics and evidence

| Concept           | Current meaning                                                                                                                                                                                               | Evidence / guidance                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow and run  | A workflow name groups independent application executions; each `workflow()` call creates a run ID. Flowmark observes the work and does not execute or retry it.                                              | The two invoice modes use `invoice.import` but produce distinct runs. Business identifiers belong in bounded properties, not as reused run IDs. |
| Step              | A named, untimed semantic checkpoint with optional local properties. It does not wrap or own business logic.                                                                                                  | `sample-source-loaded`, `invoice-skipped`, and `invoice-import-finished` explain milestones.                                                    |
| Operation         | A named, timed unit of work with its own ID. Sibling operations can overlap. A failed operation is not by itself a failed run.                                                                                | `save-valid-invoices` records its duration. The callback overload preserves the callback result and original rejection.                         |
| Error and failure | `error()` records an observed error and its `handled` flag; it does not terminate the run. `fail()` is the terminal run failure. `handled` records application handling, not independently verified recovery. | Two validation errors coexist with a completed partial import. The interrupted scenario uses a terminal failure.                                |
| Result            | Optional bounded JSON supplied on `done()` or `fail()`. It is application-reported evidence, not correctness verification.                            | The completed partial run reports `{ total: 5, imported: 3, skipped: 2, outcome: "partial" }`. Interrupted inventory and blocked shipping attach the same kind of summary to `fail()`.               |
| Progress          | Each call is an absolute snapshot. It is not a delta, heartbeat, or proof of live execution.                                                                                                                  | The interrupted run's dashboard reports its last snapshot, `2 / 5 invoices`, and separately shows the terminal failure.                         |
| Lifecycle         | Terminal markers are idempotent. Completion waits for open operations; explicit failure can supersede a pending completion. Missing terminal telemetry is ambiguous, not proof that a run is still active.    | The invoice scenario closes its measured operation before completion. The dashboard labels state as reported by the application.                |
| Context           | Initial properties and later shallow amendments provide run context; the latest value for a repeated key applies to current context. History is append-only.                                                  | `batchId`, `source`, and scenario mode make the sample investigation understandable without sensitive data.                                     |
| Correlation       | Parent and correlation identifiers are optional and explicitly propagated by application code. They group declared relationships; they do not prove causation or create automatic tracing.                    | The invoice scenario has no parent/trace relationship, so these fields are unnecessary for it.                                                  |
| Delivery          | Instrumentation delivery is isolated from business behavior. Diagnostics are reported through the configured handler/logging and explicit `flush()`/`shutdown()` boundaries.                                  | Local API ingestion returned accepted responses and both scenario runs were persisted.                                                          |

## Settled contracts

- Failed and interrupted runs may attach the same bounded `result` as
  completion. Progress remains a snapshot, not a substitute for the business
  summary the application already knows.
- `fail()` and `operation.fail()` accept a structured `{ code, message?,
  retryable? }` only. The SDK does not accept a bare string or an empty call.
- A callback operation still rethrows the original rejection. The recorded
  failure copies a structured `{ code, message?, retryable? }` when thrown, or
  `operation_failed` plus an `Error` message. It does not invent a generic
  `operation_callback_failed` code.

Reader testing is still needed to determine whether the distinction between a
handled error, failed operation, and terminal run failure is understandable.
