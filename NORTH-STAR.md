# Flowmark: north star

## The product in one sentence

**Flowmark helps developers track processes in their existing application code
and understand each execution through its context, milestones, operations,
progress, errors and result.**

Category: **workflow observability**. The data we collect: **workflow telemetry**.

> Your application does the work. Flowmark records what your code reports and
> makes it understandable as workflow history.

## The problem we are solving

An application can return successful HTTP responses and have healthy servers
while a particular import, checkout or background job produces an unexpected
result. Investigating that execution can require reconstructing it from
scattered log messages, requests and events.

Developers need both:

- **An overview of a process:** how often it runs, how often it succeeds and how
  long its recorded executions take.
- **Evidence for one execution:** which milestones it reached, what work took
  place, how progress changed, what errors were reported and what result it
  produced.

Our purpose is not simply to record start and stop timestamps. It is to make
those questions accessible through a consistent SDK and a run-first interface,
without requiring teams to build and maintain that entire view themselves.

## What we mean by workflow

A workflow is a named process a developer chooses to track. It does **not**
require a workflow engine, job framework, predefined graph or multiple steps.

Examples include a form submission, payment, file upload, invoice import,
account onboarding or scheduled job. A run is one execution of that process.

Instrumentation is explicit. Flowmark does not automatically discover processes
or know whether the application achieved its business goal.

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
application. The SDK observes the callback's duration and outcome; it does not
schedule it, retry its business logic or change its error into a success.

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

## How we differ from adjacent tools

We choose a focused default model: **workflow → run → recorded evidence**.

- Cloud metrics and infrastructure monitoring explain service/resource health.
  We add the application-defined process and its reported outcome.
- Log platforms and custom loggers capture diagnostic messages. We provide
  explicit run lifecycle, domain events and a ready-made run investigation.
- Tracing and APM describe requests, spans and dependencies. We organize the
  processes the developer names, including business context and results.
- Error tracking organizes failures. A useful workflow history also explains
  successful executions, handled problems and partial results.
- Product analytics examines user behavior and aggregate events. We focus on
  an individual application execution, including background work.

These categories overlap. Datadog, Grafana, Axiom, Better Stack, PostHog and
other platforms may already support similar views or can be configured to do
so. Structured logs and shared IDs can reproduce much of our data model.
Our differentiation is a **product and DX hypothesis**, not an exclusive
technical capability: does our focused SDK and interface make this job
meaningfully easier? Validate that with users rather than asserting it.

Keep existing tools. Do not claim native integrations, automatic log linking,
performance superiority or lower cost without implementation and evidence.

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

Today there is no hosted production service, key-rotation UI, alerting, or
durable offline delivery. Local dashboard sign-in is Better Auth email and
password; applications still use project write keys.
Delivery is best-effort with bounded in-memory buffering. Browser reports are
untrusted. Correlation is explicitly propagated by application code.

The main run list shows the latest 100 runs; related-run queries are not tied
to that window. Current aggregate metrics are not a promise of arbitrary
analytics, percentile analysis or automatic bottleneck detection.

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
