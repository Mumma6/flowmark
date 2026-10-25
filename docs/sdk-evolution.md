# Workflow telemetry: SDK and visualization roadmap

Status: Stages 1, 2, and 3 are implemented across SDK, API, persistence,
dashboard, and the Todo example. Later proposals below are not current SDK
contracts. See [product definition](./product) for positioning and limits.

## Product focus

The value is not merely recording timestamps. It is investigating which
business process a run belongs to, which explicitly recorded milestones it
reached, what the application says went wrong, whether that problem was
handled, and what result the application reports.

Flowmark should complement existing logs, tracing, error tracking, product
analytics, and infrastructure monitoring. Do not become a generic log bucket,
an infrastructure tracing replacement, or a workflow execution engine.

## Stage 1 delivered: explainable runs

The current public entry points are `@flowmark/node`,
`@flowmark/node/browser`, and `@flowmark/node/next`. The workflow API is:

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

| Method                      | Current contract                                                                             |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| `step(name, options?)`      | Instant milestone. `options` may contain `properties`; step properties belong to that event. |
| `done(options?)`            | Terminal success. `options` may contain an explicit `result` object.                         |
| `fail(reason?)`             | Terminal failure; accepts no argument, a legacy string, or `{ code, message?, retryable? }`. |
| `error(error)`              | Non-terminal error marker `{ code, message?, retryable?, handled }`; `handled` is required.  |
| `setProperties(properties)` | Append run context discovered after the run starts.                                          |

`environment` and `release` are optional in client configuration and workflow
run options. Start properties and later `setProperties()` amendments form run
context; step-local properties remain attached to their own events.

`WorkflowProperties` and `WorkflowResult` are plain JSON-safe records bounded
to depth 5, 128 total keys, 128 characters per key, 2,048 characters per
string, and 16 KiB UTF-8 encoded per object. Raw `Error` objects and class
instances are rejected rather than serialized. Failure codes are limited to
128 characters and messages/reasons to 2,048 characters; legacy strings longer
than the code limit are retained as message text under code `failed`.

The event, persistence, and dashboard layers support these fields. A handled
error can precede a successful terminal result; an unhandled error may be
recorded with a terminal failure. Retryability is descriptive: Flowmark does
not retry business work. Dashboard grouping and run investigation use the
persisted context, results, errors, steps, and outcomes; browser reports remain
untrusted.

## Stage 2 delivered: measured work and progress

Operations and progress are exported on all public workflow surfaces. An
operation is an independently identified sibling unit of work with explicit
start and terminal events. Durations use a monotonic clock; event timestamps
are for ordering/display only.

```ts
const payment = flow.operation("charge-payment")
const stock = flow.operation("reserve-stock")
payment.done()
stock.fail({ code: "OUT_OF_STOCK", retryable: false })

const receipt = await flow.operation("charge-payment", () =>
  chargeCustomer(),
)
flow.progress({ completed: 125, total: 500, unit: "rows" })
```

The callback overload returns the callback result or rethrows its exact
original rejection. It records operation failure without implicitly failing
the workflow. Explicit operations must be closed with `done()` or `fail()`;
`flow.done()` with open operations defers completion until the final operation
closes. The first completion request wins and preserves its result; other run
markers are ignored after the request, but already-open operations may close.
If an operation is never closed, the run remains open. An explicit `flow.fail()`
supersedes a pending completion. Nested operation parentage is not supported.

Progress values are absolute snapshots, not deltas: `completed` and optional
`total` are nonnegative safe integers, `completed <= total`, and optional
`unit` is a non-empty string of at most 64 characters. Each valid call is
persisted; updates are not coalesced. Duplicate event delivery is idempotent.
`operation_started`, `operation_completed`, `operation_failed`, and `progress`
are present in the `run.detail` timeline; operation rows include the operation
ID/name and terminal duration, while progress rows include completed/total/unit.

## Stage 3 delivered: explicit run correlation

Each flow exposes its own generated or caller-supplied `flow.runId`. Per-run
`correlationId` groups application-associated runs, while `parentRunId` names a
parent flow's external `runId`. Neither value propagates automatically:
applications choose if/how to pass IDs through their own request headers,
bodies, or job messages.

Identifiers are bounded, non-empty strings (`correlationId`: 128 characters;
`parentRunId`: 200). Do not put secrets or personal data in them. Browser
values remain untrusted and do not establish identity or prove an action.
Correlation means an application-declared grouping, not causality or an
OpenTelemetry trace. Parent matching is project-scoped; no match means the
parent is not recorded in the project, and duplicate external IDs across
different workflows can yield multiple matches.

The `run.related({ id })` read query accepts a dashboard-internal run UUID and
returns `{ parentMatches, related }`. `related` includes all other runs with
the same correlation ID, beyond the overview's latest-100 snapshot. Both
collections remain scoped to the authorized project; the dashboard labels
browser-vs-server origin from the workflow namespace.

## Later proposals

| Proposed API             | Goal                                                                    |
| ------------------------ | ----------------------------------------------------------------------- |
| `flow.cancel({ code })` | Distinguish intentional cancellation from failure or missing telemetry. |

Cancellation is a separate terminal outcome proposal; it must not masquerade
as failure. Structured domain events, environment/release comparisons,
operation attempts, and suspected-stuck indicators remain later considerations
pending defined counting rules and dashboard behavior. They must not imply
hidden global context, automatic identity collection, unmeasured step
durations, or automatic workflow retries.

A suspected-stuck state would be an interpretation based on per-workflow
expectations, not a fabricated failure. A late completion should resolve the
indicator without rewriting observed history. Linked browser/server runs must
retain their source and trust boundary.

## Data and privacy guardrails

- Keep properties allowlisted, bounded, and JSON-safe; do not serialize raw
  errors, request bodies, secrets, or stacks by default.
- Keep high-cardinality business IDs as lookup context, not metric dimensions.
- Expose telemetry delivery health separately from business outcomes.
- Preserve retry idempotency and bounded in-memory delivery semantics.
- Define retention, deletion, and key lifecycle before production service
  claims.
- Treat browser origin checks and quotas as basic controls, not authentication
  or abuse-proofing.

## Inspiration and deliberate differences

- [OpenTelemetry traces](https://opentelemetry.io/docs/concepts/signals/traces/)
  inform explicit measured units of work and links; Flowmark remains centered
  on business runs.
- [Sentry instrumentation](https://docs.sentry.io/platforms/javascript/tracing/instrumentation/)
  informs actionable error context, without replacing error monitoring.
- [PostHog funnels](https://posthog.com/docs/product-analytics/funnels) inform
  milestone conversion analysis; Flowmark should count runs, not people or
  sessions.

These are design references, not claims of parity or existing integrations.
