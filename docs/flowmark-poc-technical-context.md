# Flowmark POC — Technical and Conceptual Context

> **Purpose of this report:** give an independent product-research session a
> source-grounded account of what this two-day proof of concept has explored.
> The implementation and vocabulary are experiments, not commitments. This is
> context for questioning and redesigning the product, not a readiness review
> or implementation roadmap.
>
> **Later note (October 25, 2026):** dashboard sign-in is now Better Auth
> email/password with a seeded `local@dev` account. Treat auth claims below as
> the original POC snapshot; current setup is in `docs/development.md`.

## How to read the evidence

- **Implemented** means directly verified in repository code.
- **Documented intention** means the repository explicitly describes a goal,
  motivation, or intended experience. It may not be fully implemented.
- **Interpretation** means a plausible reading of the design that needs
  independent validation; it is not an attributed developer rationale.

The most relevant product statements are in `README.md`,
`NORTH-STAR.md`, and `REVIEW-PROMPT.md`.
The concrete API and data behavior is in the SDK, `packages/core`,
`packages/api`, `packages/db`, `apps/server`, and `apps/dashboard`.

---

## 1. What Flowmark is trying to achieve

### Problem and proposed solution

**Documented intention.** Flowmark is described as “workflow observability for
application code.” The motivating problem is that service health or successful
HTTP responses do not necessarily explain what happened in one particular
business process: for example, an invoice import, checkout, onboarding, or
background job. Reconstructing such an execution from separate logs, requests,
and events can be inconvenient.

The proposed solution is to let application developers explicitly mark a
process and record selected evidence about each execution: context, milestones,
operations, progress, errors, and a reported result. A dashboard then groups
executions by a developer-chosen process name and provides an investigation
view for an individual execution. The application still performs the work;
Flowmark is not described as a workflow scheduler or execution engine.

**Implemented.** The SDK creates a run and emits typed events to an ingestion
API. The API validates and persists events. The dashboard has a workflow
directory, aggregate metrics, a recent-run table, and a per-run timeline and
evidence view. See the actual implementations in
`packages/sdk/src/features/workflows/workflow-engine.ts`,
`packages/api/src/features/workflows/use-cases/ingest-events.ts`,
`packages/db/src/persistence/workflows/writes/append-event.ts`, and
`apps/dashboard/app/run-investigation.tsx`.

**Interpretation.** The product hypothesis is not that logs, traces, or
analytics cannot represent similar facts. It is that a domain-named run plus
explicitly chosen evidence and a ready-made investigation UI might be easier
to adopt than asking each team to assemble an equivalent view from general
observability tools. Whether that is a real user problem, and whether this
particular abstraction is easier, remain research questions.

### Intended developer experience

**Documented intention.** Add a client once, then place a few clear markers
around existing application code. Keep existing business functions,
frameworks, databases, loggers, and error handling. Developers choose what to
record. The SDK should not take over application execution or alter business
outcomes if telemetry delivery fails.

**Implemented.** Public SDK methods are ordinary TypeScript methods, not
Effects or Promises for each marker. `workflow()`, `step()`, `done()`,
`fail()`, `error()`, `setProperties()`, and `progress()` are called directly.
The callback form of `operation()` does return a Promise of the application's
result. In Node.js, delivery is drained through `flush()` or `shutdown()`; the
Next.js adapter registers shutdown with Next's `after()` lifecycle. Browser
delivery is asynchronous and uses `keepalive`, without an offline-delivery
guarantee.

**Interpretation.** The APIs aim to make instrumentation low-friction but
still intentional. They also ask developers to make semantic choices—what
counts as a workflow, meaningful milestones, what information is safe, and
whether an error is handled. How much ceremony this adds in real applications
has not been established by the code itself.

### Information Flowmark wants developers to gain

**Documented intention.** The north-star document names two views of a
process:

1. An overview: frequency, success rate, and duration.
2. Evidence for one execution: milestones reached, known context, work,
   progress changes, errors, and the application-reported result.

**Implemented.** The dashboard calculates total runs, failed runs, completed
success rate, median duration, daily run counts, and per-workflow summaries.
For one run it displays a derived status, accumulated context, optional
reported result, event timeline, operation duration, progress snapshots,
error details, and explicit links to matching parent/correlated runs.

**Interpretation.** The expected payoff is less reconstruction work: rather
than asking only “did the request fail?”, the UI hopes to answer “which named
process was this, what had it done, what had the application observed, and
what did the application report as its outcome?” Whether those answers are
complete or actionable depends on the event choices made by the application.

### Assumptions about existing observability tools

**Documented intention.** The north-star and review prompt position Flowmark
alongside logs, metrics, tracing/APM, error tracking, and product analytics.
They explicitly say these categories overlap and that existing tools may
already support similar views or can be configured to do so. They frame
Flowmark's possible distinction as a product/DX hypothesis: a focused SDK and
interface might make process-level investigation easier.

**Implemented.** The repository has an SDK, project-scoped event API, and a
dashboard. It does not implement native links to external log or tracing
products.

**Interpretation.** The underlying assumption seems to be about defaults and
presentation, not exclusive data collection: a business-process run may be
more convenient as the primary unit than an individual log line, metric, or
request span. An independent researcher should test that assumption rather
than treating competitor limitations as fact.

---

## 2. Current conceptual model

The current model is summarized in `NORTH-STAR.md` and
implemented as a set of typed event variants in
`packages/core/src/events.ts`. These names
describe the current experiment only; any can be altered or removed.

| Concept                  | Current meaning and relations                                                                                                                                                                                                              | Developer interaction                                                                                              | UI representation                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Workflow**             | A stable, developer-chosen name for a process. It groups runs; it is not a graph or execution engine. Example: `todo.add`.                                                                                                                 | `client.workflow(name, options)` starts one new run.                                                               | Workflow directory/groups, counts, success rate, median duration; links to runs.                                                       |
| **Run**                  | One SDK execution, identified by an external `runId`; the database also assigns an internal UUID. A run contains ordered events and derived summary fields.                                                                                | Returned by `workflow()` as a `Flow` handle.                                                                       | Recent-run rows and a run-investigation page with status and evidence.                                                                 |
| **Step**                 | An instantaneous semantic milestone, not a timed operation. Can contain event-local properties.                                                                                                                                            | `flow.step(name, { properties? })`.                                                                                | A labeled timeline event, with optional milestone properties. Latest step also appears in the run table.                               |
| **Operation**            | A named unit of work with its own operation UUID, start and terminal event, duration, and optional failure. Operations may overlap; nesting/parentage is not modeled.                                                                      | Manual `flow.operation(name)` handle with `done()`/`fail()`, or callback overload `flow.operation(name, asyncFn)`. | Operation start/end events in the timeline; operation ID and duration; summary counts. The UI does not render a nested operation tree. |
| **Progress**             | An absolute snapshot (`completed`, optional `total`, optional `unit`), not a delta. Values must be safe nonnegative integers, and `completed <= total` when total is supplied.                                                             | `flow.progress({ completed, total, unit })`.                                                                       | Each snapshot is displayed as a timeline event. There is no separate progress chart or computed current-progress panel.                |
| **Context / properties** | JSON-safe key/value data. Initial properties and later shallow amendments form run context; step properties stay attached to that step. Repeated top-level keys are replaced in the current context view, while the event history remains. | Initial `workflow(name, { properties })`, `flow.setProperties(properties)`, or step-local properties.              | Merged run context shown as JSON, plus the original properties/amendments in timeline events.                                          |
| **Error**                | A non-terminal observed error with `code`, optional `message` and `retryable`, plus required `handled`. It does not determine the run outcome.                                                                                             | `flow.error({ code, handled, ... })`.                                                                              | Error event with handled/retryable labels and summary counts.                                                                          |
| **Result**               | A small JSON-safe summary explicitly supplied by the application on `done()` or `fail()`. It is not an automatically captured response/body.                                                                                 | `flow.done({ result })` or `flow.fail({ code, result? })`.                                                          | Business result JSON panel on the terminal event.                                                                                      |
| **Outcome**              | Application-reported terminal success or failure. The database/dashboard derive status from terminal events. An operation failure alone is not a failed run.                                                                               | `flow.done()` or `flow.fail({ code, message?, retryable?, result? })`.                                              | `Completed`, `Failed`, or `Running` status; terminal failure detail when present.                                                      |
| **Correlation**          | Optional shared `correlationId` or explicit `parentRunId` metadata. It is user-propagated, not automatic distributed tracing or proof of causality.                                                                                        | Pass metadata to each run; use `flow.runId` to explicitly propagate a parent ID.                                   | Shared-correlation and parent-match sections with links to other runs in the project.                                                  |

### Overlaps and open distinctions

**Implemented.**

- A `step` and an `operation` can both name meaningful work, but only the
  operation has a duration and an independent lifecycle.
- An `error` event can coexist with a completed run. An `operation_failed`
  event can also coexist with a completed run. Only `flow.fail()` emits the
  terminal run-failure event.
- `fail()` emits terminal details using the `failed` event, while operation
  failure uses `operation_failed`; both carry a structured failure shape, but
  their meanings differ by scope.
- `done()` can be requested while operations are open. It waits for the final
  open operation to close; a later explicit `fail()` can supersede that pending
  completion.
- Run context is represented both as a current merged object on the run and as
  event history. Step-local properties are not merged into run context.
- `retryable` is descriptive telemetry. The SDK does not retry business work.

**Interpretation / questions, not conclusions.**

- Is `step` necessary if operation names can already communicate progress?
- Is the distinction between non-terminal `error`, failed operation, and
  terminal run failure intuitive to a developer at instrumentation time?
- Should a result belong only to successful completion, or should failure and
  partial-result data share one outcome model?
- Is explicit correlation enough to link important work, or does it create a
  separate relationship model that users must learn?
- Does “workflow” communicate this abstraction accurately if a single UI
  action or HTTP-bound operation is enough to qualify?

---

## 3. Current SDK design

### Initialization

**Implemented.** The Node/server entry point is `@flowmark/node`.
`createFlowmark(config?)` accepts a `FlowmarkConfig`; it resolves an API key
from `config.apiKey` or `FLOWMARK_API_KEY`, and the API origin from
`config.apiUrl` or `FLOWMARK_API_URL` (development defaults to localhost).
`defineConfig()` is a typed identity helper, not a file-discovery mechanism.
The `@flowmark/node/next` entry wraps client lifetime in Next.js `after()`.
Browser applications import `createFlowmark()` from
`@flowmark/node/browser`, using either a public key plus API origin or a
same-origin proxy path. Browser configuration cannot use a private server key.

The relevant code is in
`packages/sdk/src/client/create-client.ts`,
`packages/sdk/src/config/settings.ts`,
`packages/sdk/src/adapters/next.ts`, and
`packages/sdk/src/browser/index.ts`.

### Current public shapes

Selected signatures from
`packages/sdk/src/types/index.ts`:

```ts
interface FlowmarkClient {
  workflow(name: WorkflowName, options?: WorkflowRunOptions): Flow
  flush(): Promise<void>
  shutdown(): Promise<void>
}

interface Flow {
  readonly runId: WorkflowRunId
  step(name: WorkflowStepName, options?: WorkflowStepOptions): void
  done(options?: WorkflowDoneOptions): void
  fail(options: WorkflowFailOptions): void
  error(error: WorkflowError): void
  setProperties(properties: WorkflowProperties): void
  operation(
    name: WorkflowStepName,
    options?: WorkflowOperationOptions,
  ): WorkflowOperation
  operation<T>(
    name: WorkflowStepName,
    callback: () => PromiseLike<T>,
    options?: WorkflowOperationOptions,
  ): Promise<T>
  progress(progress: WorkflowProgress): void
}
```

Representative usage:

```ts
const flowmark = createFlowmark({
  apiKey: process.env.FLOWMARK_API_KEY,
  apiUrl: "https://flowmark.example",
  environment: "production",
})

const flow = flowmark.workflow("checkout", {
  properties: { orderId },
  correlationId,
})
flow.step("payment-authorized")
const receipt = await flow.operation("persist-order", () => saveOrder(orderId))
flow.done({ result: { receiptId: receipt.id } })

// At a process/job boundary:
await flowmark.shutdown()
```

This is an example of the current API, not a recommendation that this is the
right API. `saveOrder`, `orderId`, and provider configuration belong to the
host application.

### Lifecycle, errors, results, and delivery

**Implemented.**

- Calling `workflow()` generates a run ID unless one is supplied and
  asynchronously schedules a `started` event.
- Markers after terminal completion are ignored by the workflow engine.
- `operation(name, callback)` measures elapsed time, records completion or
  failure, and preserves the callback's returned value or original rejection.
  A failed operation does not automatically fail its run.
- `flow.error()` records an observed error but leaves the run's eventual
  outcome to the application.
- `flow.fail()` records a terminal failure but does not throw the application
  error. The surrounding application remains responsible for throwing,
  returning, retrying, or recovering.
- `flow.done({ result })` explicitly reports successful completion and an
  optional bounded result.
- Properties/results are restricted by the shared schema: at most five nested
  levels, 128 keys total, keys up to 128 characters, strings up to 2,048
  characters, and 16 KiB encoded size per object. Class instances, raw
  `Error`s, cycles, and other non-JSON values are not auto-captured.
- Delivery uses an Effect transport port. The HTTP transport sends an event
  envelope containing a UUID and retries selected transient failures with the
  same event ID/payload. The queue is bounded in memory and exposes errors via
  `onInstrumentationError`, logs, and explicit `flush()`/`shutdown()`.
- Node uses `flush()`/`shutdown()` explicitly; Next.js registers scoped
  shutdown through `after()`; browser delivery uses keepalive.

See `packages/sdk/src/features/workflows/workflow-engine.ts`,
`packages/sdk/src/features/delivery/adapters/http-transport.ts`,
`packages/sdk/src/features/delivery/delivery-queue.ts`, and
`packages/core/src`.

### Application-code constraints and influence

**Implemented constraints.**

- Instrumentation names and data are manually chosen; no process discovery or
  automatic wrapping is performed.
- The developer must decide where a run starts and ends, which events count as
  milestones or operations, whether to call an error handled, and what to put
  in context/result objects.
- The callback operation overload accepts Promise-like functions. The rest of
  the client API is synchronous at the call site, even though delivery runs
  asynchronously.
- Completion can wait indefinitely if a manually opened operation is never
  closed. `fail()` can supersede it.
- The model makes business outcomes explicit, but those outcomes are merely
  reports from instrumented code.
- Correlation and parent links require application code to forward identifiers.
- The SDK's telemetry failures are intended not to change business behavior;
  explicit delivery boundary methods can still report failures.

**Interpretation.** This design tries to minimize integration dependencies
while relying on semantic discipline from the application. A researcher should
test whether developers prefer these explicit markers, or expect
instrumentation to be more automatic, convention-driven, or derived from
existing spans/logs.

---

## 4. Architecture and data flow

### Repository structure

| Path                                          | Current role                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `packages/core`                               | Shared domain types, Effect Schema validators, event decoding.                           |
| `packages/sdk`                                | Public Node, Next.js, and browser SDK; workflow engine and delivery feature.             |
| `packages/api`                                | Framework-independent Effect use cases, ports, database adapters, API layer composition. |
| `packages/db`                                 | Drizzle/PostgreSQL schema, event writes, credentials, queries, migrations.               |
| `apps/server`                                 | Next.js routes, HTTP boundary adapters, tRPC router and fetch integration.               |
| `apps/dashboard`                              | Next.js/React dashboard consuming typed tRPC queries.                                    |
| `apps/dev-harness`                            | Loopback-only invoice, inventory and order operations app; isolated SDK diagnostics.     |
| `apps/web`, `apps/docs`, `apps/internal-docs` | Landing site, customer documentation, contributor documentation.                         |
| `packages/ui`                                 | Shared React UI primitives.                                                              |

The current package boundary is documented in
`docs/architecture.md`: `@flowmark/api` has no Next.js or
tRPC dependency; `apps/server` is the replaceable framework/protocol shell.
That separation is implemented in workspace package manifests and imports.

### End-to-end diagram

```text
Node / Next server application                Browser application
@flowmark/node or @flowmark/node/next         @flowmark/node/browser
private write key                             public browser key + Origin
             |                                             |
             +---- POST /v1/events ------------------------+
             +---- POST /v1/browser-events ----------------+
                                  |
                         apps/server (Next.js)
             route handlers + request decoding + HTTP mapping
              tRPC router / fetch adapter for dashboard reads
                                  |
                    packages/api (@flowmark/api)
        auth + event use cases + Effect ports + DB adapters
                                  |
                      packages/db (Drizzle)
       workspaces/projects -> workflows -> runs -> events
                                  |
                      project-scoped query models
                                  |
          dashboard Next.js same-origin tRPC proxy/client
                                  |
              overview -> workflow directory -> run view
```

### Event representation and storage

**Implemented.** Each telemetry event has a type, workflow name, external
run ID, and timestamp. The current event union includes:

`started`, `step`, `properties`, `error`, `operation_started`,
`operation_completed`, `operation_failed`, `progress`, `completed`, and
`failed`.

An ingestion envelope adds an `eventId` UUID. The API validates untrusted
envelopes with Effect Schema, authenticates project credentials, then appends
the event. Database writes run in a transaction. A `started` event creates or
finds the workflow and run; non-start events require a run already to exist.
Unique event IDs support idempotent duplicate delivery. Run context is
initialized from start properties and shallow-merged by later `properties`
events. The event table retains the individual evidence records; selected
fields such as properties, error, and result are also reflected in run summary
columns.

The schema is in
`packages/db/src/schema/index.ts`, the persistence
transaction in `packages/db/src/persistence/workflows/writes/append-event.ts`,
and the API repository port in
`packages/api/src/features/workflows/ports/workflow-repository.ts`.

### Actual code versus experimental/demo behavior

- **Implemented code:** TypeScript packages, SDK event generation, schema
  validation, Node/HTTP transport, API use cases, PostgreSQL persistence,
  project-scoped query code, tRPC routes, and dashboard views.
- **Runnable local setup:** the development guide uses a PostgreSQL database
  and fixed local projects/keys. Business records are synthetic per-execution
  simulations, not a persistent business database.
- **Experimental UI/product:** dashboard screens and metrics are real code,
  but the current demo data and fixed demo project do not amount to an operated
  multi-customer product.
- **Documented but absent at the original snapshot:** no hosted Flowmark API,
  alerting, native external log-platform integration, or durable offline
  queue. Dashboard email/password auth landed after this report.
- **Not established by repository evidence:** whether the current event model
  represents real production workflows well, whether the dashboard answers
  users' questions, or how it compares empirically with existing tools.

---

## 5. Current dashboard experience

### Workflow overview

**Implemented.** The dashboard overview displays:

- Total run count, completed success rate, median duration, and failed-run
  count.
- Daily recorded-run counts over the last 30 days.
- Per-workflow run count, success rate, and median duration.
- A recent run table with workflow, status, latest step, duration, and start
  time.

The summary query calculates the list of runs shown in the main run table with
a limit of 100. Workflow summaries and aggregate metrics are calculated across
the project data, rather than being limited to that 100-row table. The rate
denominator is finished runs only; running runs are excluded. See
`apps/dashboard/app/project-data.tsx` and
`packages/db/src/persistence/workflows/queries`.

The workflow directory supports text search, grouping by a name prefix,
filtering browser versus application namespace, and sorting by name or volume.
This grouping convention is UI behavior, not a schema-level workflow
hierarchy. See
`apps/dashboard/app/workflow-directory.tsx`.

### Individual runs and run details

**Implemented.** A run row links to a detail view. The detail view fetches its
event timeline and related-run query. It presents:

- Derived status (`Completed`, `Failed`, `Running`), workflow name, external
  run ID, environment/release, and start-relative event times.
- Merged context JSON, where later top-level keys replace earlier ones.
- Explicit business result JSON only if a completion event included one.
- Terminal failure code/message/retryable state when available.
- All run events in event-time order, including received time, properties,
  error fields, operation IDs/durations, and each progress snapshot.
- Counts of operations and observed/handled errors.
- Correlation ID, matching parent run(s), and runs sharing correlation.

See `apps/dashboard/app/run-investigation.tsx` and
`apps/dashboard/app/project-data.tsx`.

### What the UI communicates beyond raw events

**Implemented.** The UI gives events labels, derives a run status and duration,
merges run context, distinguishes a handled error from a terminal failure,
separates operation failure from run failure, and shows workflow-level
aggregates. It also makes the limitations of explicit links visible: a shared
correlation ID is not proof of causality, and browser reports are untrusted.

**Not implemented as a richer visualization.** Operations are rendered as
timeline entries, not as nested spans or a dependency graph. Progress is a
sequence of displayed snapshots, not a chart or computed latest-progress
summary. Results are JSON, not interpreted business objects. The dashboard
does not infer whether the reported result is correct or whether missing
events imply a failure.

**Interpretation.** Some semantic interpretation is already present in the
read model, but much of the user-facing insight depends on developers choosing
good names and useful fields. It remains open whether the resulting screen is
meaningfully more explanatory than structured logs or traces with equivalent
metadata.

---

## 6. Instrumentation examples

These examples are selected from actual demo code and tests. They are not
evidence that a production use case has been validated.

### Example A — An invoice import that rejects two records

**Underlying process.** A user imports a synthetic invoice file in the
local operations app. The Next.js handler runs the selected application
scenario using the ordinary SDK.

**Instrumentation points.**

- Server starts `invoices.import` with a batch reference and local context.
- A measured validation/save operation reports absolute progress for 5 records.
- Invalid records emit `invoice-rejected` checkpoints with invoice references
  and safe reasons, plus handled errors.
- Completion reports `{ imported: 3, skipped: 2, total: 5 }`.

Source: `apps/dev-harness/lib/business-scenarios.ts`; request boundary:
`apps/dev-harness/app/api/scenarios/route.ts`.

**Dashboard view and possible learning.** A completed run can still require
follow-up. The timeline identifies the missing date on INV-1003 and invalid
amount on INV-1005. Correct those records and reprocess them in the application;
Flowmark neither fixes nor retries work.

**Important caveat.** Inputs and storage are simulated for each execution.
The app demonstrates observation, not durable business processing. Inventory
and order scenarios additionally demonstrate partial work before failure.
Technical runtime checks live in a separate diagnostics project.

### Example B — A failed operation callback, recovered by application code

**Underlying process.** The SDK test catalog intentionally runs a callback
that throws a specific `Error`; application code catches it and completes the
workflow.

**Instrumentation.** `flow.operation("rejecting-work", callback)` measures
the callback. The rejection is caught, checked to be the original object, and
reported with `flow.error({ handled: true })`; the run then calls `done()`.

Implemented in
`apps/dev-harness/lib/sdk-scenarios.ts`:

```ts
const expected = new Error("Intentional callback rejection")
try {
  await flow.operation("rejecting-work", async () => {
    throw expected
  })
} catch (cause) {
  if (cause !== expected) throw cause
  flow.error({
    code: "CALLBACK_CAUGHT",
    message: expected.message,
    handled: true,
  })
}
flow.done({ result: { originalErrorPreserved: true } })
```

**Telemetry produced.** A failed operation with ID, duration, and failure
code; a handled error observation; then a completed run and result.

**Dashboard view and possible learning.** The timeline can distinguish the
failed operation and handled error from the final successful run outcome. A
developer could see that a local unit of work failed but application code
continued. This is an intentional simulated test, not a real provider fallback
or business recovery.

### Example C — Explicitly linked parent/child SDK runs

**Underlying process.** The SDK test catalog creates two independently
completed runs to exercise correlation.

**Instrumentation.** The parent and child share a correlation ID; the child
uses the parent's external `runId` as `parentRunId`. Each records a step and a
small result.

Implemented in
`apps/dev-harness/lib/sdk-scenarios.ts`:

```ts
const parent = client.workflow("sdk.node.correlation", { correlationId })
const child = client.workflow("sdk.node.correlation.child", {
  correlationId,
  parentRunId: parent.runId,
})
child.step("child-work")
child.done({ result: { child: true } })
parent.done({ result: { parent: true } })
```

**Telemetry produced.** Two runs, each with its own lifecycle, plus metadata
that lets the API look up matching external parent IDs and shared correlation.

**Dashboard view and possible learning.** The run page can list a parent match
and other runs sharing the correlation ID. A developer can navigate between
these declared associations. This does not encode a causal proof, automatic
context propagation, or a full distributed trace.

The catalog also includes lifecycle, context amendment, handled error,
terminal failure, manual/callback operations, deferred completion, and
progress scenarios. Their expected telemetry is documented alongside code in
`apps/dev-harness/lib/sdk-scenarios.ts`.

---

## 7. Decisions and experiments visible in the repository

The entries below describe choices visible in code/docs. Motivations are
attributed only where the documents state them.

| Observable choice                                        | Evidence and stated motivation                                                                                                                       | Status / open interpretation                                                                                |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Explicit named workflow and independent run IDs          | North-star says a workflow can be one named process, does not need a graph or multiple steps, and each call is a separate run.                       | Implemented. Whether this is a useful primary model remains open.                                           |
| SDK observes rather than executes business work          | North-star says the app owns work and Flowmark records what code reports. Callback operations wrap and measure work but do not schedule or retry it. | Implemented design boundary and documented intention.                                                       |
| Milestones and operations are separate                   | Code models a step as an instantaneous event and an operation as a start/finish pair with duration/ID.                                               | Implemented distinction; rationale beyond “milestone vs measured work” should be validated with developers. |
| Progress as absolute snapshots                           | Schema requires completed and optional total/unit; docs explicitly call values absolute, not increments.                                             | Implemented. No storage-side aggregation/coalescing or dashboard chart.                                     |
| Result explicitly reported                               | `done({ result })` attaches an app-supplied JSON-safe summary; docs explicitly state it is not an automatically captured response body.              | Implemented. How to represent partial, failed, large, or typed business results is unresolved.              |
| Error separate from run outcome                          | `error()` adds a nonterminal error event; `fail()` is terminal. Schema has required `handled`.                                                       | Implemented. The distinction may be semantically rich or overly demanding.                                  |
| Correlation is explicit metadata                         | Docs state the SDK does not propagate IDs or create distributed traces, and shared IDs do not prove causality.                                       | Implemented metadata and queries. No automatic instrumentation.                                             |
| Bounded JSON properties/results                          | Schema and docs impose explicit size/depth/shape constraints and reject class instances.                                                             | Implemented, motivated in docs by bounded, explicit context and avoiding secrets/unnecessary personal data. |
| Append-only event evidence plus denormalized run summary | Events are stored individually; selected fields are copied/merged into run columns for read models.                                                  | Implemented persistence choice. How much denormalization is needed is not a product commitment.             |
| API logic separated from server framework                | Current `packages/api` owns use cases/ports/DB adapters; `apps/server` owns Next/tRPC/HTTP.                                                          | Implemented recently as an experiment to allow another host/framework to reuse logic.                       |
| Workflow-first dashboard                                 | Workflows are summarized; individual runs are the investigation unit.                                                                                | Implemented. Whether users reason first in workflow, customer, job, request, or trace is unknown.           |

### Unresolved or deliberately experimental areas

- The vocabulary and event model have not been validated as a stable product
  contract.
- `workflow` may cover too wide a range, from UI action to long-running
  background process.
- There are three different notions of failure: observed error, operation
  failure, and terminal run failure. Their overlap may confuse or help users.
- Results and properties are generic JSON, not schema-registered domain types.
- Progress snapshots are retained as events but not transformed into a
  time-series visualization.
- Operation overlap is supported; parent-child nesting is not.
- Correlation is manually propagated and may be redundant or insufficient.
- Current browser runs use a `browser.` prefix convention, not an intrinsic
  source field on every event.
- The dashboard mostly shows explicit telemetry and basic aggregates; it does
  not diagnose or infer business correctness.
- The demo's actual business state is in memory, so the clearest product
  examples primarily validate wiring and UI navigation.

---

## 8. Fundamental design questions for independent research

These are questions, not recommendations or answers:

1. **Primary abstraction:** Do developers naturally think in “workflow” and
   “run,” or would they start from a request, job, customer action, trace,
   incident, or another unit?
2. **Meaning of a workflow:** Should a process name be stable and manually
   chosen? Is one short user action meaningfully a workflow? How should
   retries, recurring jobs, and subflows relate?
3. **Useful evidence:** What minimum set of facts makes an execution genuinely
   understandable? Which information is missing even when all current SDK
   methods are used?
4. **Steps versus operations:** Do developers need a free milestone and a
   timed operation as separate primitives? Would spans, named events, or
   ordinary structured logs be simpler?
5. **Instrumentation burden:** How many calls would a team realistically add
   to one workflow? Which values are obvious, and which require too much
   semantic judgment or duplicate existing code?
6. **Outcome and truth:** Is application-reported `done()`/`fail()` useful
   evidence, and how should the UI communicate that it is a report rather than
   independently verified success?
7. **Errors and recovery:** Do `error({ handled })`, operation failure, and
   terminal failure reflect distinct questions users ask, or should they be
   simplified into a different outcome model?
8. **Results and context:** What business result is safe, useful, bounded, and
   comparable across runs? Is free-form JSON the right form, or should
   integrations reuse application types/schemas?
9. **Relationships:** Do users need shared correlation, parent-child links,
   automatic trace context, or another navigation model? What should links
   assert—and explicitly not assert?
10. **SDK versus backend:** Which judgments belong in instrumentation, which
    can be derived from events, and which should remain presentation-only?
11. **Existing standards:** Could OpenTelemetry traces/events, structured
    logging conventions, job metadata, or another existing standard serve as a
    foundation rather than inventing a parallel model? If so, what would
    remain distinct about Flowmark's product?
12. **Essential concepts:** Which of workflow, run, step, operation, progress,
    context, error, result, outcome, and correlation are essential? Which are
    artifacts of this implementation?
13. **Meaningful differentiation:** Is there a concrete debugging task that is
    substantially easier with this flow/run UI than with a typical log/APM
    setup? Which users and processes experience that difference?
14. **Compatibility with existing tools:** Should Flowmark store only its own
    focused events, or should it primarily organize/link telemetry already
    emitted elsewhere? What is the simplest integration path for teams with
    established logging and metrics?

---

## 9. Technical inventory

### Repository structure and important files

| Concern                                | Source                                                                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Product premise and current vocabulary | `README.md`, `NORTH-STAR.md`, `REVIEW-PROMPT.md`                                                                                 |
| SDK public exports                     | `packages/sdk/src/index.ts`                                                                                                      |
| Client initialization and Node config  | `packages/sdk/src/client/create-client.ts`, `packages/sdk/src/config/settings.ts`                                                |
| Browser / Next entry points            | `packages/sdk/src/browser/index.ts`, `packages/sdk/src/adapters/next.ts`                                                         |
| Public SDK types                       | `packages/sdk/src/types/index.ts`                                                                                                |
| Run/operation lifecycle                | `packages/sdk/src/features/workflows/workflow-engine.ts`                                                                         |
| Queue and HTTP delivery                | `packages/sdk/src/features/delivery/delivery-queue.ts`, `packages/sdk/src/features/delivery/adapters/http-transport.ts`          |
| Shared event schemas                   | `packages/core/src/events.ts`, `packages/core/src/json.ts`, `packages/core/src/telemetry.ts`                                     |
| API use cases and composition          | `packages/api/src/index.ts`, `packages/api/src/runtime.ts`, `packages/api/src/features`                                          |
| HTTP and tRPC adapters                 | `apps/server/src/adapters`, `apps/server/app`                                                                                    |
| DB schema, writes, queries             | `packages/db/src/schema`, `packages/db/src/persistence`                                                                          |
| Dashboard overview and run UI          | `apps/dashboard/app/project-data.tsx`, `apps/dashboard/app/workflow-directory.tsx`, `apps/dashboard/app/run-investigation.tsx`   |
| Runnable local development harness     | `apps/dev-harness/app/operations-app.tsx`, `apps/dev-harness/lib/business-scenarios.ts`, `apps/dev-harness/lib/sdk-scenarios.ts` |

### Main public APIs and core types

```ts
createFlowmark(config?: FlowmarkConfig): FlowmarkClient

interface FlowmarkClient {
  workflow(name: WorkflowName, options?: WorkflowRunOptions): Flow
  flush(): Promise<void>
  shutdown(): Promise<void>
}

interface WorkflowRunOptions {
  id?: WorkflowRunId
  properties?: WorkflowProperties
  environment?: string
  release?: string
  correlationId?: WorkflowCorrelationId
  parentRunId?: WorkflowRunId
}

interface Flow {
  readonly runId: WorkflowRunId
  step(name: WorkflowStepName, options?: WorkflowStepOptions): void
  done(options?: { result?: WorkflowResult }): void
  fail(options: WorkflowFailOptions): void
  error(error: WorkflowError): void
  setProperties(properties: WorkflowProperties): void
  operation(
    name: WorkflowStepName,
    options?: WorkflowOperationOptions,
  ): WorkflowOperation
  operation<T>(
    name: WorkflowStepName,
    callback: () => PromiseLike<T>,
    options?: WorkflowOperationOptions,
  ): Promise<T>
  progress(progress: WorkflowProgress): void
}
```

The browser entry exports a `createFlowmark(config?: BrowserFlowmarkConfig)`
with browser-specific public-key/proxy options. The Next entry exports a
server-only `createFlowmark(config?)` that returns a workflow-only interface
and uses Next's request lifecycle.

Core types include `WorkflowName`, `WorkflowRunId`, `WorkflowStepName`,
`WorkflowCorrelationId`, `WorkflowProperties`, `WorkflowResult`,
`WorkflowProgress`, `WorkflowError`, `WorkflowFailure`, and `WorkflowEvent`.
The event variants and their schema are defined in
`packages/core/src/events.ts`.

### Current external dependencies

Versions below are the declared package ranges in manifests at the time of
inspection; they are an inventory, not a recommendation.

- **Language/workspace:** TypeScript 5.9, pnpm 10, Turborepo.
- **Effects and validation:** `effect` 3.22; `@effect/platform` 0.97.
- **Web server/app:** Next.js 16, React 19, `@trpc/server` 11.
- **Dashboard data/client:** TanStack Query 5, `@trpc/tanstack-react-query` 11.
- **Persistence:** PostgreSQL, `postgres` 3.4, Drizzle ORM 0.44, Drizzle Kit
  0.31.
- **UI/docs:** shared React components use Base UI/Radix primitives, Tailwind
  in apps, Lucide icons, and Fumadocs/MDX for docs.
- **Tests/tooling:** Vitest 3.2, ESLint 9, Prettier 3.

### Current limitations and unknowns

**Documented/implemented limits.**

- No hosted API or operated SaaS service.
- No operated SaaS provisioning. Local dashboard auth is now Better Auth
  email/password; the original POC used a fixed demo project.
- No alerting or native external log/APM integrations.
- Telemetry delivery is best-effort and memory-backed, not durable/offline.
- Browser telemetry is untrusted. Origin checks and quotas do not make it
  authoritative business evidence.
- Workflow, result, and outcome data depend on explicit instrumentation.
- The main dashboard run table shows only the latest 100 runs; dashboard metrics
  and workflow summaries use broader project queries.
- Local harness business data is simulated per execution; the app is loopback-only and never a public deployment.

**Unknown from this repository alone.**

- Whether target developers recognize the problem strongly enough to install
  another SDK.
- Whether the current terminology and event distinctions are understandable.
- Whether run-level views outperform a configured observability platform for
  the same investigation.
- Whether metrics/results are sufficient, trustworthy, and useful for
  real-world processes.
- Whether this should remain a standalone telemetry product, integrate with
  existing standards, or become a different product entirely.

The implementation provides concrete material to test those questions; it
does not settle them.
