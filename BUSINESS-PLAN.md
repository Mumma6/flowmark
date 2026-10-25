# Flowmark — Product & Business Plan

> **Status:** Working product strategy, October 2026. This is an open-source hobby project with a serious product-quality ambition, **not** a startup plan. Revisit assumptions when real usage contradicts them.

## 1. Mission

**Help people understand what their application did — and what it accomplished.**

Flowmark is an open-source workflow observability tool for existing TypeScript applications. Developers explicitly instrument important processes and get a ready-made view of individual executions, including context, milestones, operations, progress, errors, and reported results.

Flowmark **observes application code; it does not execute or orchestrate it**.

### Product promise (to validate)

> Instrument a real application process in minutes. Understand its next execution without writing custom queries or dashboards.

Two questions guide the product:

- **Developer:** What happened during this execution, and why?
- **Business / operations:** What did this execution accomplish, and is that changing?

Both questions should be answered from the same intentionally supplied workflow evidence, with different levels of presentation detail.

## 2. Why this exists

The founder has repeatedly experienced a practical gap across real applications and companies: important imports, integrations, bookings, synchronizations, and background tasks can appear technically healthy while the outcome of an individual execution remains unclear.

Developers often reconstruct that outcome from logs, database queries, traces, correlation IDs, and application-specific domain knowledge. Business, support, and product colleagues often need an engineer to translate those signals.

**This establishes a real founder problem, not yet evidence of broad external demand.** The initial user is the founder. We will validate usefulness by shipping and actually using Flowmark, then observing a handful of independent adopters.

## 3. Audience and entry point

**Primary user:** TypeScript/Node.js/Next.js developer in a small team or independent product, responsible for integration-heavy or process-heavy applications.

**Secondary reader:** Product, support, operations, or other colleagues who need an understandable summary of process outcomes, not raw telemetry.

**Initial use cases:**

1. Data imports with accepted / rejected / skipped records.
2. External synchronizations with progress, recoverable errors, and results.
3. Booking or checkout flows with meaningful partial outcomes.
4. Background jobs and scheduled processes.

These are examples, not a requirement to build integrations with any particular framework or service.

## 4. Market position and gap hypothesis

Flowmark sits **between simple job monitoring and general-purpose observability / workflow orchestration**.

| Alternative                                                | Already good at                                            | Flowmark's intended distinction                                                   |
| ---------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------- |
| OpenTelemetry + APM (Datadog, Grafana, Better Stack, etc.) | Flexible traces, events, logs, attributes, metrics         | Opinionated _workflow/run_ model and useful investigation UI with minimal setup   |
| Inngest, Trigger.dev, other workflow engines               | Excellent run and step inspection where they own execution | Observe **existing** application execution without moving it into an engine       |
| Cronitor / job monitors                                    | Job health, history, duration, custom metrics              | Richer within-run explanation and business-result context for arbitrary processes |
| Sentry                                                     | Errors and failures                                        | Understand successful, partial, and recovered processes too                       |
| Structured logs and homemade dashboards                    | Highly flexible and already available                      | Avoid rebuilding lifecycle conventions, run navigation, queries, and presentation |

**Important:** None of these capabilities is intrinsically unique. Competing systems can represent much of the same data. The potential gap is **lower effort to reach a coherent workflow understanding**, not novel telemetry primitives.

### Differentiation hypothesis

> Existing application code + explicit business/process telemetry + ready-made run investigation + readable outcome summaries.

The strongest potential value is the bridge from **technical execution evidence** to **human-readable reported business outcomes**, without requiring a BI system or custom dashboards.

This is a positioning hypothesis, **not yet proven market whitespace**.

## 5. Product principles

1. **Run-first:** one named process, many inspectable executions.
2. **Observe, don't orchestrate:** no scheduling, retries, execution engine, or required inversion of application control.
3. **Business results are first-class evidence:** allow the developer to intentionally report meaningful outcomes; never imply Flowmark verified them independently.
4. **Same data, multiple perspectives:** start with a single workflow experience that progressively reveals detail, not two disconnected products.
5. **Explicit and privacy-conscious:** collect bounded, JSON-safe context/results supplied by the developer; no automatic bulk capture of identities, secrets, payloads, or personal data.
6. **Minimal dependency / minimal ceremony:** it should feel like a small optional library, not platform adoption.
7. **Compatible rather than duplicative:** evaluate OpenTelemetry compatibility pragmatically, without letting it dictate product UX or add complexity prematurely.
8. **Small scope, excellent defaults:** prefer a focused useful workflow view over a general telemetry or BI platform.
9. **Honest states:** an app-reported `completed` is not proof of business correctness; missing telemetry is not proof that a process failed.

## 6. Scope boundaries

### In scope for the core product

- Explicit SDK instrumentation for existing TypeScript code.
- Workflow/run history and investigation.
- Milestones, optional timed operations, progress, handled/recovered errors.
- Explicit outcome and compact result summaries.
- An out-of-the-box workflow overview with useful result visibility and links to specific runs.
- Straightforward local development, documentation, and self-hosted deployment once the core product is validated.

### Explicitly out of scope

- Workflow execution engine, queues, job runner, scheduler, or automatic business retries.
- Generic APM, log management, distributed tracing, or infrastructure monitoring suite.
- Custom BI dashboard builder, arbitrary analytics query language, or data warehouse.
- Integration marketplace and connector maintenance.
- Enterprise SSO, sophisticated org permissions, complex billing, or multi-tenant SaaS operations.
- AI features added without a validated user problem.
- A hosted paid service as a prerequisite for a useful open-source tool.

## 7. Ambition, distribution and success

**Intent:** a fun, sustainable personal open-source project that is also a legitimate tool others can install and use.

**No requirement:** venture funding, rapid growth, large company, enterprise sales, or monetization.

**Initial distribution:** GitHub, npm, a clear README and quickstart, and a technical write-up illustrating the problem and its solution. The repository's local development harness is for contributors only; it is not a public demo or deployed product surface. Share selectively with TypeScript communities and developers with the same pain.

**Success ladder:**

- **1 real user:** the founder uses Flowmark in a real application and chooses to keep it.
- **3 independent users:** developers can install and derive value without author intervention.
- **10 recurring users/teams:** an exceptional outcome for the project's intended scale.

Track repeat usage and actual investigations solved, **not** just GitHub stars or downloads. Enjoyment and maintainability are part of project success.

**Business model:** free and open source. A hosted option is only a future possibility, not a strategic requirement.

**License:** open-source license to be selected deliberately before public release; do not assume one has been chosen.

## 8. Biggest risks and how to learn

| Risk                                    | Evidence that would challenge the idea                | Small validation step                                                            |
| --------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| “Just structured logs in another UI”    | Developers gain no meaningful speed or clarity        | Compare identical import/sync investigation tasks across logs, tracing, Flowmark |
| Instrumentation feels too manual        | Users avoid or remove markers                         | Instrument one existing non-demo process; record code changes and friction       |
| Business outcomes are still opaque JSON | Non-dev readers need engineers anyway                 | Prototype a readable workflow result summary using real run data                 |
| Feature creep                           | Product starts resembling APM, workflow engine, or BI | Evaluate every new feature against the two guiding questions                     |
| Standalone telemetry becomes burdensome | Maintenance/infrastructure outweighs value            | Evaluate an OTel-based backend/transport only after clarifying needed semantics  |
| Claimed “success” masks partial loss    | Completed runs hide rejected/skipped/partial results  | Test successful run with important recorded errors and partial results           |

## 9. Near-term strategic priority

The next phase is **not** production hardening or growth. It is to make one realistic process compelling from instrumentation through investigation to business-result understanding.

1. Instrument a realistic import or sync scenario.
2. Assess the minimal SDK semantics and run model needed for clarity.
3. Present reported results as more than a JSON blob, including basic across-run summaries when justified.
4. Ensure a reader can move from outcome summary to the exact run and its technical evidence.
5. Validate usefulness against structured logs / an existing trace UI before expanding scope.

See [NEXT-PHASE-PLAN.md](./NEXT-PHASE-PLAN.md) for a proposed sequence and acceptance criteria.

## 10. Reference products and standards

Competitive research inputs worth revisiting, **not** feature-completion checklists:

- [Inngest tracing](https://www.inngest.com/docs/platform-and-operations/traces)
- [Trigger.dev observability](https://trigger.dev/product/observability-and-monitoring)
- [Cronitor job monitoring](https://cronitor.io/cron-job-monitoring)
- [Langfuse observability](https://langfuse.com/docs/observability/overview)
- [OpenTelemetry specification](https://opentelemetry.io/docs/specs/otel/)

Current implementation specifics are documented separately in the Flowmark POC technical/context report; this file intentionally describes product direction rather than treating the two-day POC as a fixed architecture.
