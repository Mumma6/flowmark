# Product definition

Flowmark is **workflow observability for application code**. It helps a
developer investigate what happened inside an important business run: which
milestones were reached, what context was known, where a reported problem was
recovered or terminal, and what result the application recorded.

Developers add explicit semantic markers around business logic. Flowmark
records those observations and builds run timelines; the host application
remains responsible for executing work, handling errors, and deciding outcomes.

## Core language

- **Workflow:** a named kind of business process, such as `invoice.import`.
- **Run:** one execution of a workflow, with its own generated or supplied ID.
- **Step:** an instantaneous business milestone, not a timed operation.
- **Error:** a reported problem. `handled: true` means application code
  recovered; it is not a terminal run outcome.
- **Result:** a small, explicit business summary provided with `done()`.
- **Outcome:** `done()` or `fail()` as reported by application code.

An incomplete timeline is not proof that business work failed. A process,
browser tab, or telemetry request may stop before a terminal marker is stored.

## Positioning

**Category:** workflow observability. **Data:** explicit workflow telemetry.
**Primary interface:** a run investigation that starts with a workflow and its
specific execution.

> Your code runs the workflow. Flowmark helps explain what happened.

Flowmark complements logs, traces, error tracking, product analytics, and
infrastructure monitoring. It does not claim to replace their general-purpose
capabilities; its unit of context is the business run and the milestones its
application explicitly reports.

## Product principles

1. Instrumentation fits around application code.
2. Flowmark observes workflows; it does not execute them.
3. The SDK stays small and resilient.
4. Workflow semantics are explicit, not inferred.
5. Existing observability tools remain useful and complementary.
6. The backend owns analytics; SDK inputs are observations, not trusted facts.
7. Do not collect identity, request bodies, or raw exception data by default.
8. Do not build features without a useful, honest run-level interpretation.

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
- `fail(reason?: string | WorkflowFailure)`, where a structured failure has
  `{ code, message?, retryable? }`; the legacy no-argument and string forms
  remain supported.
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

The dashboard can inspect run context, step details, error codes, reported
results, and terminal outcomes. Metrics are derived from persisted events;
browser events remain untrusted reports and are not authoritative proof of a
business result.

## Current boundaries

There is no operated hosted Flowmark API. Local and self-hosted dashboard
sign-in is Better Auth email and password; registration creates a project and
the first write key. Applications still authenticate with a project write key.
Key rotation UI, retention cleanup, and an operated production service are
not implemented. Self-hosted deployments still own backups, deletion, and
operations. Delivery is best-effort and bounded in memory, not a durable
offline queue.

## Proposed next work

Measured operations, absolute progress snapshots, and explicit run
correlation/parent links are already in the SDK. See the
[SDK evolution plan](./sdk-evolution) for their contracts. Explicit
cancellation, business retry APIs, and further analytics remain proposals.

The stable product purpose and decision filter live in the repository-root
[north star](../NORTH-STAR.md). This document and the roadmap describe the
evolving implementation; they must not contradict that purpose.

More generally, do not claim that explicit steps equal measured work duration,
that missing telemetry proves business failure, or that retryable means
Flowmark will retry an operation. The application owns those decisions.
