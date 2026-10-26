# Flowmark — Product Vision

> **Status:** Long-term product and strategy source of truth, October 2026.
> This document replaces `NORTH-STAR.md` and `BUSINESS-PLAN.md`.
>
> It describes what Flowmark is and what it should become. It is not a
> roadmap, a sprint plan, or a claim that every capability below already
> exists. Implementation status and the development roadmap are in
> [NEXT-PHASE-PLAN.md](./NEXT-PHASE-PLAN.md).
> SDK contracts are in [SDK-SEMANTICS.md](./SDK-SEMANTICS.md) and
> [packages/sdk/README.md](./packages/sdk/README.md).

**Understand every execution. Discover what matters across them.**

Flowmark is workflow observability for processes an application already runs.
Developers mark those processes in ordinary TypeScript. Each execution becomes
evidence that can be investigated on its own, and many executions become a
picture of what the process is accomplishing and how that is changing.

**Flowmark should make understanding application processes feel effortless.**

Someone should be able to move from a reported business outcome to the
execution behind it, see what changed and where, and know which run to open
next. The ambition is an exceptional product experience for that
understanding. Simpler observability follows from it.

A focused product can be deep: clear concepts, a careful data model, and a
rich reading of what the application reports. Ambition inside that domain is
welcome. Complexity belongs when it makes the understanding substantially
easier.

## 1. Product identity and positioning

**Category:** workflow observability.

**Data:** explicit workflow telemetry. The application names the process and
reports the evidence. Flowmark does not infer a business process from generic
traces, logs, or metrics.

**Primary experience:** a workflow, its executions, and the ability to move
between one execution and the patterns across them.

Flowmark sits between job monitoring and general-purpose observability, and
beside workflow engines that inspect work only after they own it.

| Alternative | Already strong at | Flowmark's distinction |
| --- | --- | --- |
| OpenTelemetry and APM products | Flexible traces, logs, metrics, and attributes | An opinionated workflow and run model, with investigation and reported outcomes ready without a custom dashboard |
| Workflow engines such as Inngest and Trigger.dev | Excellent inspection of runs they execute | Observation of existing application code, without moving that code into an engine |
| Job monitors such as Cronitor | Health, history, duration, and custom job metrics | A full account of an arbitrary process: milestones, operations, recovery, progress, and reported results |
| Error tracking such as Sentry | Failures | Successful, partial, and recovered executions, and what those executions accomplished |
| Structured logs and homemade dashboards | Flexibility the team already has | A shared lifecycle, run navigation, and presentation, so each team does not rebuild them |

These systems can hold much of the same data. Flowmark's aim is the
experience of understanding it: a coherent account of a process, an
investigation that feels immediate, and a change across executions that leads
straight to the runs behind it.

Design references, not feature checklists:
[Inngest tracing](https://www.inngest.com/docs/platform-and-operations/traces),
[Trigger.dev observability](https://trigger.dev/product/observability-and-monitoring),
[Cronitor](https://cronitor.io/cron-job-monitoring),
[Langfuse](https://langfuse.com/docs/observability/overview),
and the [OpenTelemetry specification](https://opentelemetry.io/docs/specs/otel/).

### Vocabulary

| Concept | Meaning |
| --- | --- |
| Workflow | A stable process name that groups executions, such as `invoice.import`. |
| Run | One execution, with its own SDK `runId` and an independent lifecycle. The same name and id can continue one run across later requests. |
| Step | An instantaneous milestone. It is not a timed task. Optional properties stay on that event. |
| Operation | Named work inside a run, with its own id, start, duration, and success or failure. Operations may overlap. A failed operation does not by itself fail the run. |
| Progress | An absolute snapshot, such as 240 of 1,000 rows. It is not an increment, a heartbeat, or proof that the process is still running. |
| Run context | Initial properties plus later shallow amendments from `setProperties()`. History is retained. The latest value of a key is the current context. |
| Error | A non-terminal observation with an explicit `handled` flag. It records what the application says about recovery. It does not decide the run outcome. |
| Result | A bounded JSON-safe summary the application supplies on `done()` or `fail()`. It is not a captured response body. |
| Outcome | Application-reported completion or failure through `done()` or `fail()`. |
| Correlation | An explicit shared identifier that associates runs. It is not proof of causality. |
| Parent run | An application-supplied link to another SDK run id. It is not automatic distributed tracing. |

`retryable` describes a failure. Flowmark does not retry application work.
`done()` waits for operations that are still open. An operation that never
closes leaves completion pending. `fail()` can supersede that pending
completion.

### The product today

This is a snapshot of October 2026, so later sections can separate intention
from what a user can already do. [NEXT-PHASE-PLAN.md](./NEXT-PHASE-PLAN.md)
records whether this snapshot is still current.

Working locally, and in the repository's self-hosted shape:

- A TypeScript SDK for Node.js, Next.js, and the browser. The public surface
  is `workflow()`, `step()`, `operation()`, `progress()`, `error()`,
  `setProperties()`, `done()`, and `fail()`, plus explicit correlation.
- Validated, project-scoped ingestion into PostgreSQL. The dashboard signs in
  with Better Auth. Applications write with project keys. The dashboard can
  create, revoke, and rotate those keys.
- A workflow overview: volume, success rate, median and p95 duration, daily
  trends, week-over-week change, slowest operations, and failure codes.
- Run investigation: timeline, operations, last-reported progress, handled and
  unhandled errors, context, up to four scalar result highlights with the raw
  result retained, and explicitly related runs. Run lists show the same
  highlights and open the investigation.
- A comparison of one run's duration and reported outcome with recent peers
  of the same workflow.

Not built yet: history beyond the dashboard's latest 100 runs, search by
outcome or operation, comparison deeper than overall duration, aggregation
of business results, waterfall views, and automatic detection of meaningful
change. The reference deployment choices in
[ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md) — Neon, Vercel,
`flowmark.dev`, MIT, and 30-day retention — are decided. Neon, the four
Vercel projects, and the public hostnames are provisioned. The SDK
prerelease is published as `@flowmarkdev/node` (with `@flowmarkdev/core`).
How the stack runs, and which environment variables are local versus
production, is in [the infrastructure guide](./docs/infrastructure.md). The
retention job and a fully proven hosted register-to-run acceptance sitting
are still open.

The local harness in `apps/dev-harness` is a loopback fixture for
`invoices.import`, `inventory.sync`, and `orders.fulfill`. It is not a public
demo and must not be deployed.

## 2. The problem Flowmark solves

Important application processes can look healthy while the story of one
execution stays unclear.

An import can return success and still skip records. A checkout can capture
payment and fail while creating the shipment. A sync can time out after
saving part of a page. A game process can span several requests and finish
long after the first handler returned. A refresh job can complete on a
schedule and still have done less useful work than last time.

People reconstruct that story from logs, database rows, traces, correlation
ids, and knowledge of the code. Product, support, and operations colleagues
often need an engineer to translate it.

Flowmark exists so that reconstruction stops being the default. The developer
marks the process once. Each execution then carries its own context,
milestones, timing, progress, errors, and reported result. Over time, those
executions show whether the process is getting slower, failing differently,
or accomplishing something else, and which runs make that change concrete.

## 3. Target users and strongest use cases

**Primary user:** a TypeScript developer, on Node.js or Next.js, who owns a
process-heavy application and can add a library to existing code. Team size
is not a constraint. The entry point is a developer, not a buying committee.

**Also for:** product, support, customer success, and operations. They should
get a useful reading of what a process reported, and a direct path into the
execution when that reading is not enough. Developers remain the people who
instrument the code. Everyone else uses the same project, the same runs, and
the same authorization. There is no separate business product.

A customer says yesterday's import created only 850 of 1,000 expected
records. A support representative should be able to:

- find that import from an external reference the application chose to
  report, such as a batch id in run context
- see that 150 records were skipped
- read the failure codes or reasons the application attached
- decide whether engineering needs to go further
- open the technical execution, in the same investigation, when it does

The counts, codes, and reference remain application-reported. They are not an
independent audit. They are visible only inside the project authorization
that already governs the dashboard, and only because the application
explicitly sent them. Today a run can already carry that context and result.
Finding the execution reliably, and reading the skip without raw JSON, is
part of the discovery and outcome work still ahead.

### Where Flowmark is strong

The product earns its place when all four of these are true:

1. A named process spans meaningful work, several operations, or time.
2. Someone needs to understand an individual execution.
3. The application has useful progress, events, or outcomes to report.
4. Existing logs or APM do not already provide a convenient process-level view.

Length is not the test. A checkout that finishes in one request qualifies
when its operations and outcome are worth understanding. A process that
continues across later requests qualifies because the process, not each HTTP
call, is what someone needs to explain.

Concept evaluation against real applications has pointed to these fits:

- **Imports and data processing**, where accepted, rejected, and skipped
  records are the actual outcome.
- **Checkout and pack-opening**, where one user action contains several
  operations and a partial outcome matters.
- **Multi-request processes**, including game flows that start in one request
  and finish in a later one. An expedition can record a completed draft at
  10:02, a completed battle at 10:18, and claimed rewards at 10:26: one run,
  twenty-four minutes, three requests. The application keeps the run id and
  passes the same workflow name and id on each later call. The SDK already
  continues that run. Flowmark does not propagate the id, infer that the
  process is still active, or arrange the steps.
- **Background refresh jobs**, where completion on a schedule is not the same
  as useful work.
- **External integrations**, where timeouts, fallbacks, and recovered errors
  are part of a normal execution.
- **Appointment synchronization**, where progress and a reported result
  explain a run that would otherwise be a silent job.

Ordinary create, read, update, and delete endpoints are a weak fit. If one
request log already answers the question, Flowmark adds ceremony without
insight. The product should say so.

These fits are founder learning from real processes. They are not a market
study, and they are not a claim that those applications run on Flowmark in
production. Keep testing the model against actual workflows. Do not assume
every application needs it.

## 4. Product philosophy

1. **The process matters more than the request.** The run is the unit of
   evidence: one application process, continued across later HTTP requests,
   workers, or user interactions when the application passes the same
   workflow name and id, or completed inside a single request when that
   request contains meaningful operations. The workflow is how those runs
   become a story over time. Flowmark records the process it is shown. The
   application preserves and forwards the identifier.
2. **Observe work the application already owns.** Instrumentation wraps
   existing functions. It does not replace them, schedule them, or retry them.
3. **Reported outcomes are part of the evidence.** Technical success and
   business accomplishment are different facts. Both belong in the product.
   A completed marker remains an application report, not an audit.
4. **Same evidence, progressive detail.** Overview, run list, and
   investigation are one path. An insight names what changed, where it
   changed, and which runs are the evidence. An aggregate that cannot be
   opened is unfinished. An investigation that never connects to the pattern
   is unfinished.
5. **Explicit and privacy-conscious.** Context and results are bounded,
   JSON-safe, and chosen by the developer. Flowmark does not collect
   identities, secrets, request bodies, or raw exceptions by default.
6. **A small write API, a rich read experience.** Adding a marker should feel
   like a small library. Sophistication belongs in modeling, analysis, and
   the dashboard.
7. **Flowmark's concepts stay Flowmark's.** OpenTelemetry and other standards
   are compatibility options to evaluate when a real need appears. They do
   not rename the product's workflow, run, step, or result.
8. **Excellence over a small surface.** A feature is not suspect because it
   is advanced, slow to build, or familiar from a larger product. It is
   suspect when its complexity does not buy a clearer understanding.
9. **Honest evidence.** Missing telemetry does not prove that a run is active
   or failed. A handled error is not a failed run. A correlation is not a
   cause. Browser reports are untrusted. Progress is the last snapshot the
   application sent.

### Quality is the differentiator

Progress is how quickly and reliably someone can understand an application
process, and how effortless that understanding feels. Feature count and code
volume are not the measure.

The experience we want is specific: from a reported outcome to the execution
behind it, from a change to the operation, failure, or result that explains
it, and from there to the next run worth opening. That standard shows up in
terminology, onboarding, SDK ergonomics, defaults, navigation, visual
hierarchy, investigation, accurate statistics, visible uncertainty, empty
states, telemetry handling, interaction consistency, and documentation. The
experience should feel considered. A prettier event list is not an
investigation product.

## 5. The two product pillars

The pillars are complementary. A person should be able to move from a change
across runs to the executions that explain it, and from one execution back
to how it compares with the others.

### Pillar A — Run investigation

**Question:** what happened during this execution?

- What happened, and in which order?
- How long did each operation take, and where did the time go?
- Which operations failed? Which errors did the application recover from?
- How far did the process get, according to the last progress it reported?
- What result did the application report, including on a failed or partial run?
- How does this execution differ from comparable ones?
- Which related executions did the application explicitly connect to this one?

The current dashboard answers the first-order version of these questions:
a timeline, operation durations, errors, last-reported progress, result
highlights, related runs, and a duration comparison against recent peers.
The intended experience goes further. Investigation should make the shape of
the execution obvious, including overlap, stages, and meaningful differences
from similar runs. It should still refuse to draw causes the telemetry does
not establish.

### Pillar B — Workflow intelligence

**Question:** what can we learn from executions over time?

- Is the workflow becoming slower, and which operations account for that?
- Are failure patterns changing?
- Are certain reported outcomes becoming more common?
- Are fewer records being processed, or more being skipped?
- How do outcomes differ between releases?
- Is there a change that deserves attention, and how confident are we?
- What changed since the previous period?

**Every insight should help answer what changed, where it changed, and which
executions provide the evidence.**

A rise in p95 becomes useful when it names the recorded operations that
slowed. A falling success rate becomes useful when it names the failure
codes that account for the difference. Volume becomes useful when it also
says what those executions collectively reported accomplishing. A list of
failed runs becomes useful when the recorded evidence shows how those runs
differ from the ones that succeeded. The next investigation should be
apparent from the insight itself.

Trends, rates, and charts remain. They open the answer.

The current dashboard shows that opening: volume, success rate, duration,
week-over-week change, slow operations, and failure codes, plus recent
results one run at a time. It does not yet explain a duration change by
operation, attribute a success-rate change to failure codes, summarize what
runs reported accomplishing, or highlight how failed and successful
executions differ. Release comparison and anomaly detection are also still
ahead.

That reading stays explainable and grounded in telemetry the application
actually sent. The comparison window and the uncertainty stay visible. A
careful statistical comparison is enough to meet the bar. AI is optional,
and this pillar does not depend on it.

## 6. Core value proposition

> Mark a real process in existing TypeScript. Understand its next execution
> without writing queries. When something changes, see what changed, where,
> and which runs to open.

The promise has two parts, and both are still being validated:

- **Investigation.** A developer can explain one execution — path, timing,
  recovery, progress, and reported result — faster than by reconstructing
  logs.
- **Intelligence.** A reader can see what changed, where it changed, and
  which executions explain it, including what those runs reported
  accomplishing, and can tell which run to open next.

The first part has a working local product and founder confidence in the run
experience. It does not yet have an independent side-by-side comparison
against logs or a trace view. The second part is early: technical aggregates
exist, and business results are visible per run. A validated across-run
reading of those results does not exist yet. Synthetic harness data is not
evidence for one.

A feature is complete when the event contract, validation, persistence, read
path, visualization, documentation, and failure tests agree. A new SDK method
alone is not a feature.

## 7. Business outcome strategy

Technical execution is half of the product. The other half is what the
process accomplished, as the application chooses to report it.

```ts
flow.done({
  result: {
    imported: 988,
    skipped: 12,
    total: 1000,
  },
})
```

Today those fields can appear as a few scalar highlights and as JSON. That
is enough to tell `completed` apart from `988 imported, 12 skipped` on a
single run. It is not yet a way to follow `skipped` over time, to find runs
where `skipped > 0`, or to compare an outcome across releases.

That direction matters. It is also how Flowmark stays useful to someone who
will never read a timeline. It is a candidate for a real differentiator:
reported business outcomes, understandable in place, connected to the
execution that produced them.

### A careful data model

Do not index every JSON property. Arbitrary results mix identifiers, free
text, counts, units, schema changes, and fields that must not be aggregated.

Explore, and decide deliberately:

- **Explicit result definitions.** The developer says which fields are
  outcomes, what they mean, and which ones may be aggregated. Convention and
  inference are weaker defaults than a declaration.
- **Consistent semantics.** Counts, ratios, enums, and identifiers behave
  differently. An id is context for finding a run. It is not a chart
  dimension.
- **Bounded cardinality.** High-cardinality values stay searchable as context.
  They do not become series.
- **Safe aggregation.** Missing values, changed shapes, and failed runs with
  partial results need defined behavior. A rollup that hides a skipped
  record behind a completed status has failed.
- **Attribution.** Every outcome remains labeled as application-reported.
  Flowmark does not promote it to verified business correctness.
- **A path back to runs.** Any summary links to the executions it came from.

Failed and partial runs may carry a result. Progress does not substitute for
that summary. The goal is a faithful reading of developer-reported outcomes,
not a business-intelligence platform.

## 8. Strategic opportunities

The following are directions worth exploring. They are not commitments, not
a sequence, and not descriptions of the current dashboard. Take them up when
a real workflow shows they would materially improve understanding. Set them
aside when the evidence does not support the conclusion.

### Advanced run comparison

Today, comparison is overall duration and outcome against recent peers.

A stronger comparison would identify differences in operation duration,
operation presence and order, failure codes, progress, reported outcomes,
environment, release, and relevant context. It would say what differed and
where in the execution the difference appears. It would not claim a cause
the data cannot support.

### Workflow health and anomaly detection

Automatic, explainable signals are in scope for the intelligence pillar:

- duration regressions
- changes in failure frequency
- shifts in operation performance
- unexpected changes in how often the process runs
- changes in reported business outcomes

A signal earns its place when it answers what changed, where, and which runs
to open. Each signal needs enough evidence and a visible degree of
uncertainty. A suspected-stuck run, if it is ever shown, is an interpretation
against an explicit expectation. Silence is not a failure, and a late
completion must not rewrite history. AI may help later. It is not a
prerequisite, and it is not justified by novelty.

### Process visualization

Richer views of a single observed execution:

- an operation waterfall
- milestones that mark the shape of the run
- overlapping operations
- time spent in stages
- progress through the execution
- related runs, clearly labeled as application-declared links

Visualize what was recorded. Do not invent an orchestration graph, a causal
edge, or a span tree the SDK does not have.

### Run discovery

People should be able to ask workflow questions, for example:

- runs where `skipped > 0`
- runs that contain a given failure code
- runs where a named operation exceeded a duration
- runs of one release compared with another
- runs with an unusual reported outcome

The current run list filters the latest 100 runs. That snapshot is an
implementation limit, not a product principle. Discovery should be built on
the workflow model: runs, operations, errors, progress, and declared
outcomes. It should not become a general log query language.

### Business outcome analytics

Aggregation and visualization of declared results, as described in section 7.
This may become one of the strongest reasons to use Flowmark. It still has
to be earned with comparable real data and a semantics that stays honest
when results differ.

## 9. Architecture and developer experience

**Preferred shape:** a small, intuitive write API and a rich read experience.

The SDK should remain obvious to place inside existing TypeScript. Most new
capability should come from the data model, backend analysis, aggregations,
comparison, query, and dashboard design. Add a public SDK method only when
the telemetry required for a user question cannot be represented faithfully
with the current events. Investigate that gap before extending the surface.

Internal implementation stays Effect-first: typed errors, services, layers,
and explicit execution at the boundary. The public SDK stays ordinary
TypeScript and Promises. `packages/api` owns use cases. `apps/server` is the
protocol shell. Persistence stays behind its boundary. The dashboard uses
shared UI primitives and explains the evidence it actually has.

Architectural choices should leave room for comparison, outcome semantics,
and historical queries. Do not optimize early for enormous scale. Do not
introduce a technical ceiling merely to keep the system feeling small. The
latest-100 run window is an example of a limit to retire when discovery
needs real history. The 30-day retention chosen for the reference deployment
is an operational starting point. Revisit it if workflow intelligence needs
a longer window. That revisit is a decision, not a silent change.

OpenTelemetry compatibility is worth evaluating again when a user needs
Flowmark events in an existing collector, or when the custom transport
becomes a demonstrated maintenance burden. Adopting OpenTelemetry is not a
goal by itself. The current decision, recorded in
[TELEMETRY-INTEROPERABILITY.md](./TELEMETRY-INTEROPERABILITY.md), is to keep
Flowmark's event model until one of those reasons exists.

Privacy, project isolation, and trust boundaries stay fixed. Private server
keys never enter a browser bundle. Browser telemetry is untrusted.
Instrumentation delivery must not turn successful application work into a
thrown failure. Explicit `flush()` and `shutdown()` still surface delivery
problems. Append-only events preserve what was reported.

## 10. Open source and long-term ambition

Flowmark is open source under the MIT license. It began as a personal
project and should remain satisfying to build.

Early plans treated a handful of users, and a deliberately tiny surface, as
the definition of success. That was a reasonable constraint for an
experiment. It is retired. The product is allowed to become as useful,
polished, and widely used as its value justifies.

What that change does **not** require:

- venture funding, a company, or enterprise sales
- a monetization model designed in advance
- growth as a target independent of usefulness

A hosted API and dashboard are already part of the product. Building them
to a professional standard is in scope. Designing a commercial organization
around them is not, until real demand makes that question concrete.
Commercial use can be considered later. It is neither required nor forbidden.

**The ceiling is gone. Hypergrowth is not the replacement.**

Distribution remains a clear repository, documentation, npm
(`@flowmarkdev/node`), and `flowmark.dev`. Share it with developers who have
the problem.
Success is repeated, real investigation: someone instruments a process, keeps
it, and can explain an execution and a change across executions. Stars and
downloads do not substitute for that. Enjoyment and maintainability remain
part of success. They are reasons to refuse unjustified complexity, not
reasons to refuse depth.

### Risks worth continued attention

| Risk | What would challenge the idea | How to learn |
| --- | --- | --- |
| Logs already suffice | Investigation is no faster or clearer | Compare the same questions in logs or a trace view and in Flowmark |
| Instrumentation is too manual | Developers stop marking processes | Instrument a real process and record the friction |
| Outcomes stay opaque | Non-developers still need an engineer | Put a declared result in front of a non-developer and see whether they can read it |
| Depth without payoff | The product grows harder to understand | Apply the decision principles in section 12 before building |
| Completed hides a partial loss | A success marker conceals skipped or rejected work | Keep partial results and handled errors visible on completed runs |
| The evidence is overclaimed | The UI implies a cause, a live process, or verified correctness | Prefer the narrower statement the telemetry supports |

## 11. Explicit product boundaries

Flowmark remains workflow observability for existing application code.

**In the product:**

- Explicit instrumentation of TypeScript processes the application already runs.
- Run history, investigation, and comparison grounded in recorded evidence.
- Milestones, measured operations, progress, handled errors, context, and reported results.
- Workflow-level reading of volume, duration, failures, and declared outcomes.
- Search and filtering expressed in the workflow model.
- A hosted reference deployment and a self-hosted path, once operated and documented.
- Documentation and defaults that make the above understandable.

**Outside the product:**

- A workflow execution engine, queue, scheduler, or automatic retry of application work.
- A generic APM, log aggregation, distributed-tracing, or infrastructure-monitoring suite.
- A business-intelligence workspace, an arbitrary analytics language, or a data warehouse.
- A metrics platform, a product-analytics suite, or an integration marketplace.
- Enterprise sales machinery: SSO programs, complex billing, and multi-tenant SaaS operations. These are not required for a serious product, and they are not the current job.
- AI added because it is available, rather than because it answers a workflow question more clearly.

Powerful analytics, visualization, comparison, and outcome intelligence sit
inside the boundary. They do not pull Flowmark across it.

## 12. Product decision-making principles

Before building something, answer:

1. Does it help someone understand an execution, or discover a pattern across executions?
2. Does it solve a problem our target users actually have? Name the workflow.
3. Can it be built while the application keeps ownership of execution?
4. Does it reinforce the workflow and run model, including the path between overview and investigation?
5. Is the resulting experience substantially clearer?
6. Can the conclusion be supported by telemetry we actually have? What must the UI refuse to imply?
7. Is the maintenance cost justified by that value?

Also ask, because they have already prevented bad product claims:

- What evidence is collected, and what can it prove?
- Can it sit in existing code without changing business behavior?
- What is the privacy, runtime, storage, and operational cost?

Do not reject a proposal because it is ambitious. Reject it when the value
does not pay for the complexity, when it needs facts the telemetry cannot
provide, or when it moves Flowmark outside section 11.

Minimalism is not the goal. Usefulness and product excellence are.

Near-term plans may still sequence work and defer a feature until the data
can support it. That sequencing does not rewrite this vision. In particular,
holding back a cross-run business aggregate until comparable real results
exist is an evidence constraint. It is not a decision that outcome
intelligence is out of scope.

## 13. The long-term North Star

**Understand every execution. Discover what matters across them.**

Flowmark succeeds when a person can select a process and:

- open one execution and see what happened, what failed, what was recovered,
  how far it progressed, and what the application reported accomplishing
- see what changed across executions, where that change shows up, and which
  runs are the evidence
- move from a reported outcome or that change to the right execution, and
  know where to investigate next
- trust that the product has not invented activity, failure, causality, or
  business correctness beyond the evidence

The destination is a serious, carefully designed, open-source product for
understanding application processes. The problem deserves an experience that
feels effortless and stays honest. The way there is depth inside this domain,
validated against real processes, with a write API that stays easy and a read
experience that keeps getting more intelligent.

## References

- [NEXT-PHASE-PLAN.md](./NEXT-PHASE-PLAN.md) — current baseline and development roadmap
- [MVP-INFRA.md](./MVP-INFRA.md) and
  [ADR 0006](./docs/decisions/0006-mvp-0.1-infrastructure.md) — reference
  deployment decisions
- [SDK-SEMANTICS.md](./SDK-SEMANTICS.md) — current SDK meaning
- [TELEMETRY-INTEROPERABILITY.md](./TELEMETRY-INTEROPERABILITY.md) —
  why the custom event model remains
- [Architecture](./docs/architecture.md) and
  [product definition](./docs/product.md) — implementation-facing detail
