# Flowmark — Next Phase Development Plan

> **Status:** Core POC increments implemented, October 25, 2026; validation and cross-run insight remain incomplete. MVP 0.1 infrastructure planning starts in [MVP-INFRA.md](./MVP-INFRA.md). This is a learning-driven plan, **not** a commitment to the current models, SDK signatures, database design, or UI. Nothing in this plan requires preserving code simply because it exists.
>
> **Scope clarification:** `apps/dev-harness` is strictly a loopback-only local development fixture. It is not a public demo, customer example, or deployment target. References to the reference scenario mean using it locally to test Flowmark's value.

## 1. Objective

Make one realistic TypeScript application process easy to:

1. Instrument without restructuring application code.
2. Investigate as an individual execution (what happened, what failed, what was recovered, what resulted).
3. Understand at the workflow level (what is being accomplished over time).
4. Explain to an interested non-developer without walking through raw logs or JSON.

**Target experience:** an engineer and a product/support colleague can use the same Flowmark data at different levels of detail.

**Core principle:** Flowmark observes and explains work that the application owns; it does not execute, orchestrate, retry, or verify that work.

## Current progress — October 25, 2026

This section records implementation status, not validation with independent users.

### Done

- Inspected the current SDK, telemetry models, API/persistence path, dashboard, and local harness against the product direction.
- Replaced the original invoice fixture and Todo app with six deterministic local operations scenarios across `invoices.import`, `inventory.sync`, and `orders.fulfill`. They cover complete results, rejected invoices, an interrupted sync, and a carrier failure after stock reservation. SDK diagnostics use a separate project.
- Improved run investigation using existing telemetry: scalar result highlights with raw JSON retained, explicit attribution to application reports, last-reported progress, and wording that does not infer an active run from missing terminal telemetry.
- Passed stored completion results through the project snapshot read model. Run lists show reported result highlights; workflow pages show up to five recent individual outcomes linked to their run investigations. No arbitrary cross-run aggregation has been added.
- Renamed the Todo app to `@flowmark/dev-harness`, documented its local-only purpose, and bound its dev/start commands to `127.0.0.1`.
- Added focused tests for invoice telemetry and result/progress presentation.
- Validated the original completed/interrupted invoice fixtures end to end against local PostgreSQL, including results, handled errors, measured operations, and last-reported progress. Subsequently verified all six replacement operations scenarios through the SDK/API/database/dashboard path; see Workstream A for the current scenarios.
- Reviewed current SDK/model semantics against the scenario in [SDK-SEMANTICS.md](./SDK-SEMANTICS.md). The existing API supported this use case without a public SDK change.
- Recorded the telemetry interoperability decision in [TELEMETRY-INTEROPERABILITY.md](./TELEMETRY-INTEROPERABILITY.md): retain the current model for now; no OTel dependency, exporter, or migration is justified by present evidence.

### Still to do

- Run the planned side-by-side walkthrough with an actual developer and a non-technical reader; compare the same questions with logs or a trace view where practical. No independent usability result is claimed.
- Reassess whether a cross-run result insight is useful after reader feedback. The local database contains repeated synthetic operations scenarios, not independent business activity; summing fixed sample data or extrapolating a trend would be misleading, so no cross-run business aggregate has been implemented.
- Record participant findings, evidence gaps, and whether the developer would keep the SDK installed. Do not invent participant feedback or treat the local harness as a public demo.
- Instrument an actual application process, or refactor the local example around ordinary application functions and inputs. The current scenario runner verifies telemetry but does not yet demonstrate natural integration into existing business code.

### Transition to MVP 0.1

The founder has reviewed the run experience and expressed confidence in its
usefulness. This is valuable founder feedback, not the independent comparison
required below. The phase is therefore **not fully complete**: reader validation,
natural application integration, and the successful-phase criterion for an
across-run business insight remain open. Deliberately deferring an aggregate is
not the same as implementing or validating it.

Infrastructure planning may proceed in parallel under
[MVP-INFRA.md](./MVP-INFRA.md). This is a new phase, not a claim that hosted
deployment, authentication, or npm distribution already work.

## 2. Current POC baseline (verify in repository)

The POC report describes:

- `createFlowmark()` and `client.workflow(name, options)` producing a run handle.
- `step()`, `operation()`, `progress()`, `error()`, `setProperties()`, `done({ result })`, `fail()`.
- Event-based ingestion into a PostgreSQL-backed API.
- A workflow directory, overview metrics, run-investigation timeline, context, errors, result JSON, and recent per-run outcome highlights.
- A loopback-only operations harness with invoice import, inventory sync and order fulfillment, plus SDK diagnostics isolated in a separate project.

Remaining product limitations:

- Results still need deliberate comparison across runs; recent per-run result highlights are implemented, but no cross-run business insight is validated.
- Last-reported progress is surfaced on run investigation; it must not be represented as guaranteed live/current progress.
- The invoice-import scenario demonstrates the product locally, but no independent reader has validated that it is convincing or understandable.
- The local harness remains local-only and must not be published or deployed.

**These are observations, not reasons to preserve the architecture.** Recheck actual repository state before making changes.

## 3. Non-goals for this phase

- No workflow engine, scheduling, task queue, automatic retries, or business execution ownership.
- No generic logs/traces/APM ingestion product.
- No dashboard builder or general BI analytics.
- No SaaS billing, enterprise permissions, SSO, or multi-tenant launch work.
- No integration marketplace or broad provider adapters.
- No speculative AI features.
- No telemetry standard migration before we have an explicit problem it solves.
- No “production-ready” refactor marathon before the core experience proves useful.

## 4. Workstream A — Build a meaningful reference scenario

**Why:** the Todo CRUD scenario demonstrates connectivity, but hides why Flowmark is useful. Keep it as a local-only developer harness, not a public showcase.

**Implemented:** `apps/dev-harness` is now a local-only operations app with fixed
synthetic records, source tables and six repeatable scenarios. The original
Todo example has been replaced; low-level SDK checks have their own diagnostics
page and project so they no longer pollute the operations dashboard.

The scenario currently includes:

- `invoices.import`: all 5 imported, or 3 imported and 2 rejected with exact record references and handled validation errors.
- `inventory.sync`: all 12 updated, or a retryable page-3 timeout after saving 8 products.
- `orders.fulfill`: stock reservation and a shipping label, or a carrier failure after reservation.
- Measured operations, meaningful checkpoints, absolute progress and non-sensitive batch/sync/order references.
- A concrete next action in the harness and a link filtering the dashboard to that SDK run ID.
- A guarded, explicit local telemetry reset; no automatic deletion or direct SQL seeding.

Tests verify recorded events, reported results, request validation and diagnostic
project isolation. These remain simulations, not real suppliers or persistent
business storage. Automatic retry/recovery is not implemented.

**Verified:** the six scenarios execute from the harness and persist through the
SDK/API to local PostgreSQL, producing three workflow names in the dashboard.
**Still needed:** walk a developer and non-technical reader through the same
questions. Technical verification does not establish reader comprehension.

**Acceptance:** a reader can identify which run skipped records, how far an interrupted run last reported progress, and what each successful run reported accomplishing.

**Guardrail:** example instrumentation should resemble code a developer would willingly maintain in an actual app.

## 5. Workstream B — Validate the minimal SDK and telemetry semantics

**Status: review completed.** [SDK-SEMANTICS.md](./SDK-SEMANTICS.md) records the decision to retain the current API and the remaining questions. Integration friction and reader comprehension still need validation.

**Why:** we should not finalize ten concepts just because the POC currently exposes them.

Review `Workflow`, `Run`, `Step`, `Operation`, `Progress`, `Context`, `Error`, `Result`, `Outcome`, and `Correlation` against the reference scenario.

For each concept, answer:

- What concrete user question does it answer?
- Is it straightforward to instrument correctly?
- Could another concept already represent it without loss of clarity?
- Does it create ambiguous or misleading meaning?
- Is it necessary for the initial useful product?

Specific questions to settle deliberately:

1. **Run:** Is a single named process execution still the most natural primary unit?
2. **Step vs operation:** Keep a milestone distinct from timed work? If yes, make semantics obvious.
3. **Failures:** Distinguish handled error, failed operation, and terminal run failure without confusing readers.
4. **Result:** Should failed/partial runs also report useful outputs? The POC attaches `result` to completion; examine alternatives.
5. **Progress:** Show **last reported** progress without implying the process remains active or completed beyond recorded evidence.
6. **Lifecycle:** What does `Running` mean when telemetry stops? Avoid inventing failure or completion from silence.
7. **Correlation:** Is manual parent/correlation propagation necessary for the initial scenario or safely deferrable?

**Deliverable:** a short `SDK-SEMANTICS.md` decision note (or equivalent) with examples of the chosen API and alternatives rejected/deferred. The file is proposed, not presumed to exist.

**Acceptance:** the scenario can be instrumented clearly with minimal calls; no Flowmark callback must own the entire application process; instrumentation must not change business function return values or error behavior.

## 6. Workstream C — Make reported business results useful

**Why:** `done({ result: { imported: 988, skipped: 12 } })` is useful evidence, but a raw JSON panel alone is weak as a product feature.

Start with **small, developer-supplied, structured results**, not automatic business inference.

### Current implementation and remaining exploration

Current POC-style reporting:

```ts
flow.done({
  result: {
    total: 1000,
    imported: 988,
    skipped: 12,
  },
})
```

The current UI presents up to four scalar fields from a run result, retains raw JSON for detail, labels the result as application-reported, and shows recent run outcomes with links to individual investigations. The result travels through the existing project snapshot read model; no telemetry or database schema migration was needed.

Possible future work, only if validated by a real comparison need:

- Compare a selected, explicitly comparable result field across runs.
- Filter/find runs with meaningful result differences (for example `skipped > 0`), if cheap and natural.
- Preserve access to raw event/result evidence and links to the runs that support any summary.

**Do not** blindly aggregate every JSON field. Mixed schema versions, missing values, arbitrary strings, IDs, units, and privacy-sensitive fields make naive rollups misleading.

Before building cross-run aggregation, decide:

- How can a developer identify fields suitable for summary (explicit declaration, convention, or opt-in)?
- What is a safe default when run results differ in shape?
- Do we need values such as counts, ratios, and units, or can we keep v1 simpler?
- How should results be shown for failed or partial executions?
- What does an application-reported result mean vs independently verified correctness?

**Implemented first slice:** up to four scalar result fields are shown on run detail and run lists; the workflow page shows up to five individual recent results. This is per-run visibility, not an across-run summary. Do not build a generic query language or chart configurator.

**Acceptance:** an engineer and a non-developer can distinguish `run completed` from `988 imported; 12 skipped`, with clear attribution that these values were reported by the application.

## 7. Workstream D — One workflow experience, progressive detail

**Why:** we want technical investigation and business insight without inventing two separate products.

**Implemented first slice:** run investigation presents scalar reported-result highlights, preserves raw result JSON, labels progress as last reported, and avoids treating a run without terminal telemetry as confirmed active. The run list shows result highlights. Workflow-specific pages display up to five recent individual outcomes, each linked to its exact investigation.

**Still needed:** assess this hierarchy with readers and decide whether a safe across-run insight adds value. A workflow-level rollup is not implemented.

Proposed information hierarchy:

```text
Workflows
  -> Workflow overview: activity, outcomes, meaningful reported result trends
       -> Run list: status, time, duration, key result(s), last reported progress
            -> Run investigation: full timeline, operations, errors, context, result
```

Questions each level should answer:

| Level             | Essential question                                                              |
| ----------------- | ------------------------------------------------------------------------------- |
| Workflow overview | What has this process reported accomplishing, and is that changing across runs? |
| Run list          | Which specific execution needs attention?                                       |
| Run details       | What happened and what evidence explains the reported outcome?                  |

Design rules:

- A run should remain the core evidence unit.
- Do not replace the investigation timeline with only aggregate charts.
- Clearly label `completed`, `failed`, and **last seen/reported** states.
- Surface partial outcomes and handled errors without equating every error with a failed run.
- Treat result trends as optional and meaningful, not obligatory for every workflow.
- Keep the screen understandable without assuming the reader knows internal code concepts.

**Deliverable:** working design/implementation for one coherent happy-path and partial-success investigation, including navigation from outcome summary back to the exact run.

**Acceptance:** a non-developer can see the reported import outcome without reading raw JSON; an engineer can drill into skipped/error events and operation timing.

## 8. Workstream E — Telemetry architecture decision (research spike only)

**Decision recorded:** [TELEMETRY-INTEROPERABILITY.md](./TELEMETRY-INTEROPERABILITY.md) recommends retaining the current custom model and transport for this phase. No migration or dependency was added. Revisit only if a concrete compatibility or maintenance problem makes integration useful.

**Question:** should Flowmark continue using its own append-only events and transport, or eventually encode/export through OpenTelemetry?

Do **not** start by migrating. First compare options against these criteria:

- Does the public SDK remain tiny and intuitive?
- Can the model represent a named run, milestone, timed operation, progress, handled errors, and reported results faithfully?
- Are run-centric queries and business-result summaries easy to build?
- Does the approach materially reduce maintenance or improve compatibility?
- Does it force unwanted terminology, execution coupling, or infrastructure?
- Are there data volume, privacy, and self-hosting trade-offs?

**Deliverable:** a short decision note comparing:

1. Retain custom event model/transport for now.
2. Keep the Flowmark API but map events to OTel internally or through an exporter.
3. Other small compatibility option, only if justified by actual needs.

**Acceptance:** a reasoned decision with explicit deferred questions. No architectural rewrite merely to match industry fashion.

## 9. Validation — prove useful, not novel

Use the **same** example and questions to compare:

- Existing structured logs.
- A reasonably configured trace tool (if practical, not a weeks-long benchmark setup).
- Flowmark.

Ask the tester to answer:

1. Which specific import failed or partially succeeded?
2. How many records were imported and skipped?
3. Where did a recoverable error occur?
4. What was the last reported progress before the process stopped reporting?
5. What changed across two runs?

Record:

- Instrumentation changes / developer effort.
- Time to locate the relevant execution and explain its outcome.
- Questions not answerable with available evidence.
- What confused the developer or non-developer reader.
- Whether the developer would keep the SDK installed.

**Pass condition:** at least for the chosen scenario, Flowmark demonstrably reduces reconstruction effort and improves outcome clarity. It does not need unique primitives, enterprise features, or many users.

## 10. Suggested sequence and checkpoints

This is a sequence of learning checkpoints, **not** a fixed sprint schedule.

| Order | Step                                                  | Status / next checkpoint                                                                                                                                                                                                                   |
| ----- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | Inspect current implementation against the POC report | **Done.** Direction and implementation gaps were reviewed.                                                                                                                                                                                 |
| 2     | Implement/reference one realistic import or sync      | **Implemented and end-to-end validated locally.** Both scenarios persisted through PostgreSQL/API and were visible in workflow and run investigation views. This is not independent user validation.                                       |
| 3     | Review SDK/model against that use case                | **Done.** [SDK-SEMANTICS.md](./SDK-SEMANTICS.md) records current semantics, evidence, and open questions. No public API changes were made.                                                                                                 |
| 4     | Improve run-result presentation                       | **First slice done.** Scalar result highlights, raw JSON, honest progress/status copy, and run-list results are implemented. Validate comprehension with readers.                                                                          |
| 5     | Add a modest workflow-level result insight            | **Assessed; implementation deferred.** The current fixed sample has too little independent comparable data to support a truthful aggregate. Revisit after reader feedback or a real data scenario establishes useful comparison semantics. |
| 6     | Connect overview to investigation                     | **Implemented.** Recent individual outcomes link to exact investigations; the live PostgreSQL-backed flow was verified. Reader comprehension remains untested.                                                                             |
| 7     | Evaluate OTel options in a design note                | **Decision recorded.** Retain the current custom event model for now; see [TELEMETRY-INTEROPERABILITY.md](./TELEMETRY-INTEROPERABILITY.md). No migration is planned.                                                                       |
| 8     | Run a small side-by-side usability test               | **Awaiting real participants.** Compare the same questions in Flowmark and existing logs/a trace view; record effort, time, confusion, unanswered questions, and SDK retention intent.                                                     |

**Next action:** conduct the developer/non-developer walkthrough and side-by-side comparison. Then use those findings to decide whether a cross-run insight is both useful and semantically safe; implement it only if the evidence supports it.

The local dev harness is not a public example or launch surface. Hosted deployment
and release preparation belong to the subsequent MVP phase in
[MVP-INFRA.md](./MVP-INFRA.md), not to this phase's completed work. A telemetry
migration remains unjustified.

## 11. How to choose the next coding task

For any proposed change, answer these before implementation:

1. **Who benefits?** Developer investigating a run, or colleague reading results?
2. **Which question becomes easier to answer?** Give an example from the reference process.
3. **Can we express it with existing evidence?** Avoid new SDK concepts when UI/read-model work suffices.
4. **Is it small?** Prefer one end-to-end improvement over broad abstraction work.
5. **Does it violate non-goals?** Reject orchestration, generic APM/BI expansion, or premature platform building.
6. **How will we know it worked?** State an observable acceptance criterion.

## 12. Definition of a successful next phase

- A realistic integration/import process is instrumented naturally in existing TypeScript code.
- Runs make success, failure, recovery, progress, and reported partial results legible.
- The workflow view offers at least one genuinely useful across-run business insight, backed by comparable reported data and linked to relevant runs.
- A non-developer can understand the reported result; a developer can drill into the cause/evidence.
- The SDK stays focused and preserves application execution behavior.
- We have a documented, deliberate decision about telemetry interoperability rather than an assumed OTel migration.
- We have tested the experience against a reasonable log/trace alternative.
- The local development harness remains clearly internal and loopback-only; it is not published or deployed as a demo.
- The project still feels fun and small enough to maintain.

**If these goals reveal that parts of the current SDK/model/UI are unnecessary, remove or redesign them. A two-day POC is evidence to learn from, not a contract to defend.**

## 13. Related document

- [BUSINESS-PLAN.md](./BUSINESS-PLAN.md) — mission, audience, positioning, scope boundaries, and definition of success.
