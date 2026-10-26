# Product definition

> Long-term direction, ambition, and the decision framework are in
> [PRODUCT-VISION.md](../PRODUCT-VISION.md). This page describes the current
> product model and must stay consistent with that vision.

Flowmark is **workflow observability for application code**. Mark a process
and see volume, duration, success rate, and the result of each execution:
milestones, measured operations, progress, errors, and the reported outcome.

## Core language

- **Workflow:** a named kind of business process, such as `invoice.import`.
- **Run:** one execution of a workflow, with its own generated or supplied ID.
- **Step:** an instantaneous business milestone, not a timed operation.
- **Error:** a reported problem. `handled: true` means application code
  recovered; it is not a terminal run outcome.
- **Result:** a small, explicit business summary provided with `done()` or
  `fail()`.
- **Outcome:** `done()` or `fail()` as reported by application code.

An incomplete timeline is not proof that business work failed. A process,
browser tab, or telemetry request may stop before a terminal marker is stored.

## Positioning

**Category:** workflow observability. **Data:** explicit workflow telemetry.
**Primary interface:** a run investigation that starts with a workflow and its
specific execution.

> Mark a process. See the numbers, then open the run.

The unit of context is the business process and the evidence your application
reports.

## Product principles

1. Instrumentation fits around application code.
2. Flowmark records the process the application already runs.
3. The write API stays focused and resilient. Depth belongs in the read experience.
4. Workflow semantics are explicit.
5. The backend owns analytics; SDK inputs are observations.
6. Do not collect identity, request bodies, or raw exception data by default.
7. Every feature should help someone understand an execution or a pattern
   across executions, and a pattern should lead back to the runs behind it.

## Stage 1 delivered

The first explainable-run slice is implemented in the SDK, ingestion,
persistence, dashboard, and local operations harness.

```ts
const flow = flowmark.workflow("invoice.import", {
  properties: { batchId },
  environment: "production",
  release: "2026.10.2",
})

flow.step("file-validated", {
  properties: { rowCount: rows.length },
})
flow.error({
  code: "IMPORT_PROVIDER_TIMEOUT",
  handled: true,
  retryable: true,
})
flow.setProperties({ provider: "backup" })
flow.done({ result: { saved: 1236, skipped: 4 } })
```

The delivered public API includes:

- `step(name, options?: { properties?: WorkflowProperties })`
- `done(options?: { result?: WorkflowResult })`
- `fail({ code, message?, retryable?, result? })`. `code` is required. The
  optional `result` is the same bounded business summary accepted by `done()`.
- `error(error: WorkflowError)`, where the required `handled` boolean
  distinguishes a recovered problem from an unhandled one. This marker does
  not itself end the run.
- `setProperties(properties)` to append context discovered after run start.
- Optional `environment` and `release` metadata in client configuration and
  per-run options.

Properties and results accept bounded plain JSON-safe objects only. Limits are
depth 5, 128 total keys, 128 characters per key, 2,048 characters per string,
and 16 KiB UTF-8 encoded per object. Raw `Error` instances and class instances
are not serialized. Step properties remain local to their event; run context
combines the start properties with later `setProperties()` amendments.

The dashboard shows volume, success rate, median duration, run context, step
details, error codes, reported results, and terminal outcomes. Metrics are
derived from persisted events.

## Current boundaries

The reference Neon database exists and has the committed schema. There is no
operated hosted Flowmark API. Local and self-hosted dashboard
sign-in is Better Auth email and password; registration creates a project and
the first write key. Applications still authenticate with a project write key.
The dashboard can create, revoke, and rotate ingestion keys. Retention
cleanup and an operated production service are not implemented. Self-hosted deployments still own backups, deletion, and
operations. Delivery is best-effort and bounded in memory, not a durable
offline queue.

## Proposed next work

Measured operations, absolute progress snapshots, and explicit run
correlation/parent links are already in the SDK. See the
[SDK evolution plan](./sdk-evolution) for their contracts. Explicit
cancellation, business retry APIs, and further analytics remain proposals.

The stable product purpose and decision filter live in the repository-root
[product vision](../PRODUCT-VISION.md). This document and the roadmap describe
the evolving implementation; they must not contradict that purpose.

More generally, do not claim that explicit steps equal measured work duration,
that missing telemetry proves business failure, or that retryable means
Flowmark will retry an operation. The application owns those decisions.
