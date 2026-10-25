# Flowmark: north star

## The product in one sentence

**Flowmark helps developers track processes in their existing application code
and understand each execution through its context, milestones, operations,
progress, errors and result.**

Category: **workflow observability**. The data we collect: **workflow telemetry**.

> Mark a process in your application. Flowmark turns each execution into
> volume, duration, success rate, and a reported result you can open.

## The problem we are solving

Operations need to know how often a process runs, how often it succeeds, how
long it takes, and what a specific execution produced.

Flowmark answers both:

- **Process insight:** volume, success rate, and median duration.
- **Run evidence:** milestones, measured operations, progress, errors, and
  the reported result.

## What we mean by workflow

A workflow is a named process a developer chooses to track — a form
submission, payment, file upload, invoice import, account onboarding or
scheduled job. A run is one execution of that process.

Instrumentation is explicit: you name the process and report the result.

## How Flowmark fits into existing code

Keep the existing functions, frameworks, database calls, loggers and error
handling. Add observations around the points that explain the process.

```ts
async function importInvoices(batchId: string, rows: Invoice[]) {
  const flow = flowmark.workflow("invoice.import", {
    properties: { batchId },
  })

  try {
    const result = await flow.operation("save-invoices", () =>
      saveInvoiceRows(rows),
    )
    flow.step("invoices-saved", {
      properties: { skipped: result.skipped },
    })
    flow.done({ result: { saved: result.saved, skipped: result.skipped } })
    return result
  } catch (cause) {
    flow.fail({ code: "INVOICE_IMPORT_FAILED" })
    throw cause
  }
}
```

`Invoice`, `saveInvoiceRows` and the configured `flowmark` client belong to the
application. The SDK records the callback's duration and outcome.

## Our vocabulary

| Concept     | Meaning                                                                                                        |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| Workflow    | A stable process name that groups executions, such as `invoice.import`.                                        |
| Run         | One execution, with its own SDK `runId` and independent lifecycle.                                             |
| Step        | An instantaneous milestone, optionally carrying event-local properties. Not a timed task.                      |
| Operation   | Named work inside a run, with its own ID, start, duration and success/failure. Operations may overlap.         |
| Progress    | An absolute snapshot such as 240 of 1,000 rows, not an increment.                                              |
| Run context | Initial properties plus shallow amendments made with `setProperties()`. History is retained.                   |
| Error       | A non-terminal observation with an explicit `handled` flag. It does not decide the run's outcome.              |
| Result      | A small JSON-safe summary explicitly supplied by the application. Not an automatically captured response body. |
| Outcome     | Application-reported completion or failure through `done()` or `fail()`.                                       |
| Correlation | An explicit shared identifier associating runs. It is not proof of causality.                                  |
| Parent run  | An application-supplied relationship to another SDK run ID. It is not automatic distributed tracing.           |

A failed operation can be handled and followed by a completed workflow.
`retryable` describes a failure; it does not make Flowmark retry application
work. `done()` waits for already-open operations to close. An operation that
never closes leaves that completion pending; `fail()` can supersede it.

## Where the value should appear

1. **Instrumentation:** adding useful context should require little ceremony
   and preserve ordinary TypeScript inference and application behavior.
2. **Workflow overview:** group runs by process, with honest volume, success
   and duration summaries derived from persisted observations.
3. **Run investigation:** show context, operations, progress, errors and results
   together rather than requiring reconstruction from unrelated records.
4. **Related executions:** navigate explicitly linked browser, server and job
   runs without pretending we automatically observe every technical boundary.

A feature is not complete because a new SDK method exists. It needs a sound
event contract, validation, persistence, useful read APIs, understandable
visualization, documentation and successful/failing-path tests.

## What we collect

The model is **workflow → run → recorded evidence**.

From that evidence we derive volume, success rate, and duration for a process,
and a timeline plus result for one execution. Named operations add their own
timing. Progress snapshots show how far a long job got.

Do not claim native integrations, automatic log linking, or cost comparisons
without implementation and evidence.

## Non-negotiable principles

- Observe; do not become a workflow execution engine.
- Fit around existing code; do not require an application rewrite.
- Keep the public SDK ordinary TypeScript, with Promise methods where useful.
- Use composable Effect services, typed failures, layers and Schema internally.
  Execute effects only at explicit boundaries.
- Prefer explicit, bounded, JSON-safe context over automatic bulk capture.
  Never collect secrets, identity, bodies or raw exceptions by default.
- Instrumentation failures must not turn successful business work into failure.
  Explicit delivery boundaries must still surface delivery problems.
- Preserve project isolation and keep private credentials out of the browser.
- Explain the limits of the evidence. Missing telemetry is **not** proof that
  business work failed; a completed marker is an application report, not an audit.
- Use shared shadcn UI components first. Make visualizations explain the data,
  not decorate an unsupported product promise.
- Prefer complete useful slices over a large collection of disconnected APIs.

## Current implementation, not the destination

Implemented: Node/Next.js/browser SDKs; milestones, context, structured errors,
results, measured operations, progress and explicit run correlation; validated
ingestion; PostgreSQL persistence; project-scoped dashboard summaries,
timelines and related-run navigation.

The architecture is TypeScript with Next.js/React applications, Effect/Schema
services, HTTP ingestion, tRPC/TanStack Query reads, PostgreSQL/Drizzle,
shared shadcn UI, Fumadocs, pnpm/Turborepo and Vitest.

Hosted production, key-rotation UI, alerting, and durable offline delivery
are still upcoming. Local dashboard sign-in is Better Auth email and
password; applications still use project write keys.
Delivery is best-effort with bounded in-memory buffering. Browser reports are
untrusted. Correlation is explicitly propagated by application code.

The main run list shows the latest 100 runs; related-run and compare queries
are not tied to that window. Aggregates include volume, success rate, median
and p95 duration, daily trends, week-over-week change, slowest operations,
failure codes, and comparison of one run to the last 20 of the same workflow.

This section must evolve with the implementation. The purpose above should
remain stable unless we consciously change the product direction.

## The decision filter

Before building something, ask:

1. Which concrete question about a process or its executions will this answer?
2. What evidence do we collect, and what can it actually prove?
3. Can it fit naturally into existing code without changing business behavior?
4. How will a developer find and understand the result in the dashboard?
5. What is its privacy, runtime, storage and operational cost?
6. Is this focused workflow observability, or drift into a generic tool?
7. Can we show a realistic example and test the full path, including failures?

**North-star test:** can a developer select a process and a run, understand its
reported path and result, and investigate the relevant evidence without
manually piecing together the story from separate records?

## Supporting references

- [Internal documentation index](./docs/README.md)
- [Architecture](./docs/architecture.md)
- [SDK implementation and roadmap](./docs/sdk-evolution.md)
- [Development and verification](./docs/development.md)
