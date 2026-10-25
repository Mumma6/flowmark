# Independent Flowmark review prompt

Copy the prompt below into another AI. It is self-contained product context,
not a source-code or credential dump. If repository access is appropriate,
provide it separately under your normal access policy; never paste secrets or
private customer telemetry. The reviewer should independently verify claims.

---

You are an independent, skeptical product and developer-experience reviewer.
Evaluate Flowmark, an early-stage workflow observability product for TypeScript
applications. Do not validate the idea just to be agreeable. Find weak
assumptions, unclear positioning, missing value and avoidable complexity.

Respond in Swedish. Distinguish:

- Verified implementation evidence.
- Claims supplied in this brief but not independently verified.
- Product hypotheses.
- Proposals that do not exist yet.

If you cannot access the repository or run the software, say so. Never imply
you inspected code or tested a feature when you did not.

## Product purpose

Flowmark helps developers track processes in their existing application code
and investigate individual executions using context, milestones, operations,
progress, errors and results.

The problem: service health and individual log records do not automatically
give a convenient history of a particular invoice import, checkout, form
submission, onboarding flow or background job. Teams can construct that view
themselves; Flowmark aims to package the instrumentation and investigation.

Landing positioning:

> Track what happens in your application.
>
> Follow a form submission, payment, import or background job—from individual
> steps to errors and results. You choose what to track with a TypeScript SDK.
> No workflow engine required.

Category: workflow observability. Data: workflow telemetry.
Flowmark is not a scheduler or execution engine. It does not discover or
instrument all processes automatically. A workflow can be any named process
the developer chooses, even one user action.

## Vocabulary and current SDK

- Workflow: stable process name, for example `invoice.import`.
- Run: one execution with an SDK `runId`.
- `step(name, { properties }?)`: instantaneous milestone, not timed work.
- `setProperties(properties)`: append a shallow run-context amendment.
- `error({ code, message?, retryable?, handled })`: non-terminal problem.
  The application reports whether it handled the error.
- `fail(string | { code, message?, retryable? })`: terminal failure.
- `done({ result }?)`: terminal success, optionally with a small business result.
- `operation(name)`: manually closed operation handle with `operationId`,
  `done()` and `fail()`.
- `operation(name, asyncCallback)`: measures callback duration, records outcome,
  returns its value or rethrows the exact original rejection.
- `progress({ completed, total?, unit? })`: absolute progress snapshots,
  not deltas; completed/total are validated nonnegative safe integers and
  completed cannot exceed a supplied total.
- `correlationId` and `parentRunId`: optional per-run relationship metadata.
  `flow.runId` can be explicitly propagated by application code.
- `flush()` and `shutdown()`: explicit client delivery/resource boundaries.
- `defineConfig()`: a typed identity helper; no automatic config discovery.

Operations can overlap as siblings; nested operation parentage is not currently
modeled. An operation failure does not automatically fail the workflow.
`done()` requested with open operations waits for them to close and preserves
the first requested result. A leaked operation can therefore leave completion
pending. Explicit `fail()` supersedes pending completion.

Properties/results are bounded JSON-safe objects: depth 5, 128 total keys,
128-character keys, 2,048-character strings and 16 KiB UTF-8 encoded per object.
Raw Error instances and class instances are rejected, not auto-serialized.
Context is explicit; request bodies, personal identities and stack traces are
not captured automatically.

This is illustrative integration code; Invoice, saveInvoiceRows and the
configured client belong to the host application:

```ts
async function importInvoices(batchId: string, rows: Invoice[]) {
  const flow = flowmark.workflow("invoice.import", {
    properties: { batchId },
  })
  try {
    const result = await flow.operation("save-invoices", () =>
      saveInvoiceRows(rows),
    )
    flow.done({ result: { saved: result.saved, skipped: result.skipped } })
    return result
  } catch (cause) {
    flow.fail({ code: "INVOICE_IMPORT_FAILED" })
    throw cause
  }
}
```

## Architecture

```text
Customer server / Next.js             Customer browser / React
@flowmark/node or /next               @flowmark/node/browser
private write key                    public browser key + allowed Origin
            |                                  |
     POST /v1/events                  POST /v1/browser-events
            +------------------+---------------+
                               |
                  Next.js HTTP route adapters
                               |
       Effect services: authorization -> Schema -> ingestion/repository
                               |
              PostgreSQL + Drizzle transactions/migrations
                   workflows -> runs -> events
                               |
               project-scoped query services + tRPC
                               |
       dashboard server proxy -> TanStack Query -> React dashboard
```

SDK public interfaces are ordinary TypeScript/Promises; Effect is the internal
foundation for composable asynchronous services, typed failures, dependency
injection/layers, sequencing, cancellation and resource management. Pure
functions stay ordinary TypeScript. Execution belongs at explicit boundaries.
HTTP delivery uses Effect HttpClient. Next.js delivery uses `after()`;
plain Node owns explicit flushing/shutdown.

The API validates event envelopes, derives the project from credentials and
commits storage before acknowledging ingestion. Event UUIDs support retry
deduplication. Read credentials are separate from write credentials, and read
queries are project-scoped. Direct browser ingestion has an origin allowlist
and shared per-key quota; those are not user authentication or a complete
abuse-prevention system. Browser telemetry is untrusted.

Dashboard: grouped/searchable workflow directory; run volume, success rate
among finished runs, median duration and daily activity; run timelines with
context, results, errors, operation duration and progress; explicit parent and
related-run navigation. Main run list is latest 100; related queries are not
restricted to that list.

Correlation is manual metadata, not automatic distributed tracing. Shared
correlation indicates association, not proven causation. No native external
log-platform integration or automatic log linking is claimed.

Monorepo: TypeScript, pnpm and Turborepo. Applications use Next.js/React.
Shared UI uses shadcn components; docs use Fumadocs/MDX. Customer and local-only
internal documentation are separate applications. Vitest covers domain,
SDK and API behavior, including real PostgreSQL integration tests.
Drizzle Studio provides a local database browser.

## Current limitations

This is self-hosted/local-development software, not an operated hosted SaaS.
The dashboard currently has a fixed demo account, not production user/session
authentication. Production customer provisioning, key lifecycle, retention,
alerting and an operational service are not provided.

Delivery is best-effort and bounded in memory: no durable queue or offline
guarantee. Transport retries do not retry business work.
An incomplete run is not proof of a failed business operation.
Application-reported completion is not independently verified truth.
Business retries, explicit workflow cancellation and advanced analysis are
future areas, not implemented promises.

## Competitive and DX hypothesis

Flowmark is not assumed to have capabilities competitors cannot implement.
Its proposed differentiation is the default experience:

**Name a process -> record meaningful execution evidence -> investigate a run,
without designing your own log schema, queries and run-view UI from scratch.**

Cloud logs/metrics, APM/tracing, error tracking, product analytics and log
platforms remain useful. Examples to compare include Datadog, Grafana,
Better Stack, Axiom, PostHog and a team's own structured logger. You do not
need to cover every vendor; choose representative alternatives.

Compare the concrete job, not category labels. Existing tools can overlap
substantially. An OpenTelemetry span with attributes/events, correlated logs
or a custom analytics dashboard may solve much of the same problem.

Our desired DX: explicit lightweight calls around existing code, strong
TypeScript inference/JSDoc, injectable testable internals and useful views
without mandatory replacement of the framework/logger. These are design
intentions, not evidence of being faster, simpler or cheaper than competitors.

If making claims about a competitor's current functionality, verify them
against current primary documentation and cite sources/date. If browsing is
unavailable, label the comparison provisional. Do not upload source code,
credentials or customer data to external tools.

## Review requested

1. **Explain it back.** Who benefits, what concrete problem is solved and what
   does the developer get beyond timestamps or another collection of events?
2. **Challenge the category.** Does “workflow” imply an execution engine or a
   required framework? Is the product narrower or broader than its wording?
3. **Walk through real use cases.** Pick an import, checkout and background
   job. Show what code is added, what evidence appears and what remains unknown.
   Identify cases where Flowmark adds little value.
4. **Compare alternatives honestly.** Use a table: task, existing-tool solution,
   Flowmark solution, setup/maintenance tradeoff, overlap and missing evidence.
   Include “build it with structured logs” as a serious alternative.
5. **Review DX.** Evaluate naming, synchronous markers versus async operations,
   lifecycle ownership, deferred completion, failure handling, progress
   semantics, explicit correlation, config, browser trust and delivery failure.
   Point out footguns; propose smaller APIs where warranted.
6. **Review architectural fit.** Are SDK/event/schema/ingestion/storage/query/UI
   responsibilities coherent? Does Effect simplify the internal design without
   burdening users? Consider event ordering, duplicate delivery, missing terminal
   events, identifier collisions and project isolation.
7. **Review the evidence model.** Can the UI distinguish application outcome,
   telemetry delivery and inferred state? Identify misleading visualizations or
   unsupported conclusions.
8. **Assess focus.** Which next features deepen the core value, and which would
   turn it into an undifferentiated log tool, APM clone or workflow engine?
9. **Propose validation.** Give a small user-research/prototype plan with
   measurable criteria: time to first useful run, time to diagnose an example,
   amount of instrumentation, ongoing maintenance and users' existing solutions.
   Do not fabricate market demand or willingness to pay.

If repository access is provided, start with NORTH-STAR.md, docs/architecture.md,
docs/sdk-evolution.md, packages/core, packages/sdk, packages/db, apps/api and
apps/dashboard. Review actual code before treating this brief as implemented
fact. Test the relevant scenarios when possible. Cite file/line evidence and
report commands actually run. The local SDK test catalog is an integration aid,
not proof by itself that assertions passed.

## Response format

- Short, candid verdict.
- What is convincing versus unproven.
- Findings ranked by impact, with evidence and concrete examples.
- Fair alternatives/DX comparison table.
- Recommended changes: now / next / avoid.
- Five most important unanswered questions.
- A clearer positioning paragraph without marketing fluff.
- Validation plan and explicit limits of your review.

Do not give a generic “great idea” answer. If the differentiation is weak, say
so and explain what evidence or product change could make it stronger.
