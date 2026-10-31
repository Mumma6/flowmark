# Durable expectations contract

TASK-012 design decision, 31 October 2026; implemented in source by TASK-014.
**Requires the accepting migrations/API/readers and a separately published aligned
SDK release.** Source implementation does not establish hosted rollout or npm
availability. This document records the implemented contract. Flowmark observes
application-owned work; it never executes, schedules, retries or confirms it.

## Public API and identity

Ordinary TypeScript signatures, available from Node, Next and browser:

```ts
import type { WorkflowOutcome, WorkflowResult } from "@flowmarkdev/core"

interface ExpectationReference {
  readonly version: 1
  readonly workflow: string
  readonly runId: string
  readonly expectationId: string
}
interface ExpectationOptions {
  readonly id: string
  readonly within: string
}
interface ExpectationResolution {
  readonly outcome?: WorkflowOutcome
  readonly result?: WorkflowResult
}
interface ExpectationCancellation {
  readonly code: string
  readonly message?: string
}

// Added to Flow and TypedFlow:
interface FlowExpectationMarkers {
  expect(name: string, options: ExpectationOptions): ExpectationReference
}
// Added to configured clients, including Next's request adapter:
interface ClientExpectationMarkers {
  resolveExpectation(
    reference: ExpectationReference,
    options?: ExpectationResolution,
  ): void
  cancelExpectation(
    reference: ExpectationReference,
    options: ExpectationCancellation,
  ): void
}
```

Methods enqueue telemetry. A reference is serializable application data, **not**
a delivery acknowledgment, credential or verified promise. Node uses existing
`flush()`/`shutdown()`; Next registers `after()` in each reporting request even
when no workflow starts; direct browser clients use existing flush/keepalive
semantics. Resolve/cancel do not create a workflow, emit another start, inherit
another run's final result or execute a business callback. Existing instrumentation
diagnostics and explicit drain failures contain invalid input and delivery errors.
Typed workflow definitions keep the same expectation contract; resolution data
is independent of the owning run's generic result/outcome types.

Identity is `(authenticated project, canonical workflow, external run ID,
expectation ID)`. Credentials provide the project; it is neither a claim in the
reference nor a lookup across projects. Workflow/run IDs use the existing
nonblank 200-character ingestion bounds. Expectation ID and name are nonblank,
case-sensitive strings of at most 128 characters, without ASCII control
characters; values are preserved, not trimmed or case-folded. A repeated business
confirmation needs a fresh ID, even when its name is unchanged. Different names
with the same ID conflict. IDs may repeat in different owning executions.

Use existing bounded `WorkflowOutcomeSchema`, `WorkflowResultSchema` and failure
code/message bounds for settlement fields. No arbitrary context, raw exception,
stack, request body or automatic redaction is added. The 64 KiB ingestion envelope
limit still applies. For the first slice, at most **100 distinct expectation IDs
per run**, including IDs with unmatched settlement evidence, may reserve storage.
A new ID beyond this limit gets HTTP 429 `EXPECTATION_LIMIT_REACHED`; duplicates
and settlement/declaration of an already reserved ID remain admissible. The SDK
must not retry this run-lifetime limit as a transient rate limit.

A reference is meaningful only under the configured project's credentials. Using
it with different credentials never reads or changes the original project. If an
identical tuple independently exists in the second project, it identifies only
that second project's expectation; the reference cannot prove its origin. Do not
use it as a globally unique business identity or authorization token.

## Duration and server observation

`within` accepts a positive decimal integer immediately followed by exactly one
of `ms`, `s`, `m`, `h`, `d`: for example `500ms`, `30s`, `5m`. No whitespace,
leading zeros, fractions, signs, composites or case variants; maximum 11 input
characters. Convert with checked
integer arithmetic to canonical `withinMs`, between 1 and 604,800,000 inclusive
(seven days). Equivalent forms such as `60s` and `1m` are the same declaration.
Reject unsupported grammar, overflow and longer durations at the SDK and HTTP
boundaries. Duration bounds do not promise that retention covers the deadline.

The first accepted declaration fixes `declaredAt` from the database server clock
at persistence, **after acquiring the owning-run lock**, and fixes
`deadlineAt = declaredAt + withinMs`. Store these values. Client `timestamp` is
shown separately as application-reported time; it never sets the deadline or
wins a settlement race. Use the same database clock for accepted settlement
observation and read-time `asOf`. Capture one clock value per decision; use
receipt ordering to break equal-time concurrency. A repeated declaration cannot
reset or extend the deadline.

At `asOf <= deadlineAt`, an unresolved declaration is `pending`; after that it
is `overdue`. Resolution observed at or before the deadline is `met-on-time`;
resolution observed after it is `met-late`. Late means **observed late by
Flowmark**, not proof that the provider or business action occurred late.
Delivery delay, offline clients, queueing and server clock adjustments remain
limitations. A restart does not reset persisted deadlines. No timer, cron,
background transition event or notification is implied, and no read means no
background observation or alert.

## Facts, acceptance and ordering

Three wire events extend the existing `{ eventId, event }` envelope.
All include `workflow`, `runId` and application `timestamp` as today:

```ts
{ type: "expectation_declared", expectationId, name, withinMs }
{ type: "expectation_resolved", expectationId, outcome?, result? }
{ type: "expectation_cancelled", expectationId, code, message? }
```

Wire durations are safe integer milliseconds with the bounds above; the SDK
converts the public grammar before emission. The reference version is checked
at the client boundary; v1 maps to these event types. Unknown reference versions
are invalid, never guessed. Source/project are not trusted fields in an envelope.
No automatic matching from `step`, operation names, correlation, parent links,
results or unrelated runs is permitted.

The owning run must already exist: otherwise HTTP 409 `RUN_NOT_FOUND`, with no
phantom run or orphan fact. Once that run exists, a resolve/cancel arriving before
its declaration is accepted as **unmatched evidence**, reserving one bounded ID.
It has no deadline, promise state or attention contribution. Show it separately
as "Settlement recorded; declaration unavailable". A later declaration matches
only the exact scoped ID and supplies its immutable deadline. The earlier action
keeps its original server observation time; a pre-declaration resolution is
therefore observed on time, with the order mismatch explicitly visible. Do not
rewrite receipt history to pretend declaration arrived first. If the declaration
never arrives, it never becomes pending, met or overdue.

For each identity, retain at most one effective declaration and one effective
settlement, plus their immutable envelope facts:

- Same accepted event ID and expectation identity/kind: HTTP 202 `duplicate`;
  original payload wins, even if a replay attempts to change it. No amendment.
  An event ID belonging to another run, project, expectation ID or fact kind is
  HTTP 409 `EVENT_CONFLICT`, without disclosing foreign identifiers. The latter
  identity check is specific to new expectation facts; legacy behavior stays.
- New event ID, same normalized declaration name and duration: HTTP 202
  `duplicate`, no new effective fact and no deadline reset. Different name or
  duration for that ID: HTTP 409 `EXPECTATION_CONFLICT`.
- First resolve or cancel accepted under the lock wins the settlement, even if
  unmatched. The same kind and payload with a new envelope ID is a semantic
  duplicate. Compare bounded JSON structurally (object key order irrelevant,
  array order significant); omitted optional fields equal omission, not null.
- Opposite settlement kind, changed resolution outcome/result or changed cancel
  code/message: HTTP 409 `EXPECTATION_CONFLICT`. No undo, reopen, overwrite or
  later winner. A genuinely new expectation uses a fresh ID.
- A semantic duplicate with a new envelope ID records duplicate receipt evidence
  in the immutable event history, retaining that ID and receipt order, but never
  replaces the canonical declaration/action or its observation time. Return
  `duplicate`; count only canonical facts. Rebuild uses first accepted receipt
  order, not application timestamps. A repeated identical envelope adds nothing.
  Duplicate history follows existing ingestion limits and retention; it is not
  a second promise or a hidden permanent deduplication ledger.
- Malformed input: HTTP 400. Credential/source failures: generic HTTP 401/403.
  Conflicts and rejected events create no effective fact. Keep bounded diagnostics
  without exposing another project's existence or payloads.

Use the existing envelope identity lock and owning-run row lock in one database
transaction. Reserve/check the ID limit, validate first facts, append immutable
history and update the small projection atomically. Do not acknowledge storage
failure as accepted. A transport retry reuses its envelope ID and never resets
observation time. Rejected missing-run reports are not silently retained/retried;
the application may re-report telemetry after start delivery, without rerunning
business work. SDK explicit drains expose failure; no durable offline queue is
promised.

## Derived state and narrow post-terminal extension

A declaration plus no settlement derives pending/overdue. A declaration plus
resolution derives met-on-time/met-late, independent of whether its reported
business outcome was positive. A declaration plus cancellation derives
`cancelled`. Cancellation observed after the deadline carries
`cancelledAfterDeadline: true`; show "Cancelled after deadline" and the original
deadline. It no longer contributes to current overdue attention. Similarly,
met-late retains its deadline and late observation; it does not become on-time
because the current state is settled. Derive a passed-deadline interval from the
facts without inventing a historically emitted overdue event.

[The existing terminal policy](./run-continuation.md) is extended **only** for
new resolve/cancel facts on existing runs, including unmatched settlements.
They may be accepted after completed/failed, without changing execution status,
final outcome, final result, technical run duration or original start metadata.
Expectation-local outcome/result must never enter run-terminal aggregation or
latest-business-report selection. Closing a run does not fulfill or cancel any
expectation and does not wait for one. An expectation is not an open operation.

A new declaration requires an open owning run; after terminal it receives HTTP
409 `EXPECTATION_DECLARATION_CLOSED`. An already accepted matching declaration
can still be replayed idempotently without a new effective declaration; a new
envelope ID records duplicate receipt evidence only. The local closed
handle diagnoses a new `expect()` declaration without emitting it; the returned
reference still proves no delivery. Remote terminal state is checked at ingestion.
Every other marker and conflicting run terminal keeps TASK-003's current policy.
Historical runs are not reopened or reinterpreted.

## Credential and browser boundary

Server write credentials can declare/settle expectations only within their own
project. Read keys and dashboard sessions cannot use telemetry writes. Direct
browser credentials use existing origin/quota enforcement and `browser.`
workflow names. The browser SDK returns a reference with that canonical prefix;
the declaration matches its existing namespaced run. Resolve/cancel require a
canonical browser reference at both SDK and browser-ingestion boundaries; reject
an authoritative server reference rather than silently retargeting it. Browser
reports cannot upgrade their provenance through JSON fields, prefix tricks or
copied server references. A server credential writing to `browser.*` still creates
browser-scoped, untrusted evidence, never authoritative evidence.

**Initial proxy boundary:** the existing generic same-origin proxy forwards with
a server write key and does not attest a browser source. TASK-014 must reject all
three expectation event types at that proxy before forwarding, with HTTP 403
`EXPECTATION_SOURCE_FORBIDDEN`. Browser expectation users must use the existing
direct public-browser-key mode. Plain proxy telemetry stays unchanged. Never
solve this by trusting a `source` field/header from the browser or exposing a
server key. Supporting expectation forwarding through a separately authenticated
browser-source proxy is future work, not a prerequisite or an implicit namespace
migration. Advertise/document this restriction explicitly, including diagnostics.

A trusted server callback that settles a server expectation authenticates with a
server write key on the server. The application owns its provider webhook
validation; receiving a copied reference alone does not authorize the webhook or
prove its business event occurred.

## Persistence, reads, retention and UI

The implementation adds the three event enum values and bounded expectation payload storage
on immutable workflow events, plus a minimal `workflow_expectations` projection
keyed uniquely by owning internal run ID and expectation ID. Projection stores
nullable declaration/action fact references, fixed declaration/deadline times,
first settlement kind/time and provenance. Missing declaration is explicit, not
a placeholder deadline. Keep each effective payload in its immutable fact;
projection reconstruction must preserve original server receipt times. Never
reconstruct declaration time from a rebuild's current clock.

Foreign keys/transactions must keep facts and projection consistent and cascade
with owning-run retention. If raw facts expire independently, invalidate/remove
projections depending on them in the same retention operation; a projection
must not become an archive of expired payloads or identifiers. Index by run/ID and unresolved deadline for scoped
attention reads. Project authorization belongs in API use cases and every
persistence join, including direct internal-UUID reads. Keep SQL/transactions in
`@flowmark/db`, Effect use cases in `@flowmark/api` and protocol mapping in the
server shell. No scheduler, additional service or general graph engine.

A run-detail response includes one server `asOf`, up to 100 ID records, source,
reference, name, application and receipt timestamps, fixed deadline/duration,
settlement code or outcome/result, derived state, ordering anomaly and evidence
links. Unmatched IDs are a separate collection, excluded from state counts.
Pending/open labels must not imply that the process is alive. The UI uses
"Pending confirmation", "Overdue — no resolution observed", "Observed on time",
"Observed late" and "Cancelled", with the late-cancellation qualification above.
Negative resolution outcomes are shown beside timing, never relabeled success.

Run Explorer adds an expectation-state filter (`pending`, `overdue`,
`met-on-time`, `met-late`, `cancelled`) using SQL `EXISTS`, not a filter on the
latest overview snapshot. Any matching declaration qualifies the run once.
Combine with existing workflow/status/environment/release/date/business filters.
Use a maximum 90-day started-at window, constrained by retained data, page size
1–100 and existing stable started-at/internal-ID keyset pagination. Reject an
out-of-bounds query explicitly; never silently truncate its cohort. Expectation
records are individually bounded by the per-run limit; overview counts aggregate
SQL across the full selected retained cohort, including runs beyond the first 100. Count/list predicates must share the same state rule.

Attention shows "X of N runs have overdue expectations" and separately "Y
overdue expectations". N is all authorized retained runs matching the base
filters **before** the expectation-state filter, including runs with no
expectation. X counts distinct runs with at least one unresolved declared
expectation past deadline; Y counts those expectations. Completed/failed runs
remain eligible unless the user filters technical status. Clicking attention
carries the same base filters plus `overdue`; do not add technical failures to X
or use Y as the run denominator. Compute list/count results within one consistent
database snapshot and one server `asOf`. Separate requests may change as receipts
arrive or deadlines pass; show refreshed observation time rather than promising
cross-request snapshot equality. Tests use one fixed server clock for parity.

Retention is unchanged. Seven days is a maximum duration, not an extension of
the reference deployment's 30-day telemetry policy. An older run can expire
before a later declaration's deadline. Delete its expectation facts/projection
with the run; no hidden tombstone, identifier archive or permanently retained
unresolved record. Report "Expectation evidence unavailable under current access
or retention" for missing detail; never infer met, cancelled or business failure
from absence. Lost/incomplete facts cannot justify a definitive met/late state;
show unavailable evidence, exclude it from authoritative state counts and expose
a bounded integrity diagnostic. Counts describe **retained observed evidence**,
not all business promises ever made. Cleanup policy itself is outside this task.

## Worked booking and acceptance scenarios

Illustrative application-owned booking, requiring an accepting backend:

```ts
const flow = flowmark.workflow("booking.submit")
const confirmation = flow.expect("provider-response", {
  id: "confirmation-opaque-42",
  within: "5m",
})
// Persist confirmation in application storage / provider metadata explicitly.
// Perform the application's existing booking submission; Flowmark does not.
flow.done({ outcome: "submitted", result: { submitted: 1 } })
// Node may await flush before handing off; Next drains this request with after().

// Later authenticated server callback, after the app validates the provider:
flowmark.resolveExpectation(confirmation, {
  outcome: "no-availability", // response arrived; the booking was not successful
  result: { reserved: 0 },
})
// Alternative application cancellation path, not an additional settlement:
// flowmark.cancelExpectation(confirmation, { code: "BOOKING_CANCELLED" })
```

Use a deterministic server clock and inspect SDK envelope → authorized append →
immutable facts/projection → read state → dashboard for each case in TASK-014:

1. Declare at 12:00, five minutes, resolve at 12:04: two facts, fixed 12:05
   deadline, met-on-time. Exact 12:05 resolution is also on time. Boundary reads
   at 12:05 unresolved are pending; at 12:05:00.001 they are overdue.
2. No resolution: pending before deadline, overdue after; restarting SDK/API at
   12:03 changes nothing. No background event or notification is created.
3. Resolve observed 12:06 with client timestamp 12:04: met-late, both timestamps
   visible, original deadline retained. No claim of provider lateness. A late
   resolution removes current overdue attention but preserves late evidence.
4. Repeat the declaration at 12:04 using `300s`, new envelope ID: duplicate,
   still 12:05 deadline. Changed name or `6m` conflicts. Repeat an accepted action
   with reordered result object keys: duplicate. Changed outcome/result conflicts.
5. Resolve at 11:59:59 after owning-run start but before declaration receipt at
   12:00: unmatched evidence first; later exact declaration yields met-on-time
   with the earlier observation and explicit order anomaly. Cancel-first behaves
   analogously. With no declaration it stays unmatched, never attention.
6. No owning run: 409, no facts/projection. Start followed by an application-owned
   re-report can record the evidence. Missing telemetry does not become a failure.
7. Cancel at 12:02: cancelled. Cancel at 12:06: cancelled-after-deadline evidence,
   not current overdue. Resolve after accepted cancel (or cancel after resolve)
   conflicts; concurrent actions have exactly one first accepted winner.
8. Resolve `outcome: "no-availability"` on time: expectation timing met-on-time,
   booking result reserved zero, no invented business success. Owning run stays
   completed/submitted, even if its expectation later resolves negatively.
9. Complete/fail the run at 12:01, resolve/cancel later: dedicated fact accepted;
   status/outcome/final result/duration unchanged. New declaration conflicts;
   ordinary report/progress/operation/error markers retain terminal suppression.
   Matching declaration replays remain duplicates; only a new-ID audit receipt
   may be added, never another effective declaration or a reset deadline.
10. Two declarations with the same name but different IDs are independent. An
    existing ID with changed meaning conflicts. The 101st distinct ID is rejected;
    settlement of the first 100 and semantic duplicates still work at capacity.
11. Re-deliver one envelope concurrently: one effective fact. Reuse its ID for a
    different identity/kind/project: conflict with no foreign details. Transaction
    failure leaves no accepted orphan fact or half-written projection.
12. Project B credentials and a project A reference cannot access A. Test both
    missing local identity and identical independent tuples. Direct browser or
    generic proxy attempts to settle an authoritative expectation are rejected;
    copied refs, forged source claims and namespace aliases cannot upgrade trust.
13. Match 150 retained runs, 23 with 31 overdue expectations including completed
    runs and evidence beyond the first page: attention 23/150 and 31, filtered
    Explorer total 23 at the same `asOf`. Cancellation/late settlement changes
    current attention without revising technical failure or business-result counts.
14. Expire a run under existing retention: no surviving expectation identifiers
    or attention count. An unavailable declaration/action is never interpreted as
    a successful confirmation. Projection rebuild from retained intact facts
    preserves timestamps, deadline, first action and state.

## Implementation and rollout order

1. Core schemas, pure state/grammar rules and fake-clock fixtures; public types
   are delivered with the runtime. Cover every scenario above.
2. Add enum/payload/projection migrations and transactional acceptance rules;
   verify a populated loopback upgrade, immutable facts and rebuild behavior.
3. Implement authorized API reads/writes, full-cohort filter/count SQL and
   provenance; keep server handlers thin. Integration-test two projects, direct
   browser origin/quota checks and fail-closed proxy handling.
4. Implement Node/Next/direct-browser/typed-definition markers using existing
   delivery resources. Add root advanced factory
   `createFlowmarkWithTransport({ transport, onInstrumentationError?, delivery? }): FlowmarkClient`,
   taking the existing `WorkflowTransport` contract. It owns one shared client
   lifecycle and supplies settlement methods without a fabricated run. Preserve
   the existing low-level `workflow()` API; its returned Flow gains `expect()`,
   while cross-request settlement uses a configured or advanced client. Test Next settlement-only request drains, original
   application return/error preservation, Node restart and external consumer types.
5. Deliver dashboard detail/history, unmatched evidence, attention and Explorer
   links. Browser-verify pending → overdue → observed-late with a controlled
   isolated test clock, cancellation, terminal-run immutability and cohort parity;
   never change a shared service/system clock for acceptance testing.
6. Update SDK/API/privacy/delivery docs and a runnable booking callback example.
   Do not claim shipped functionality before this complete vertical slice passes.

Old servers must reject the new event types; no fallback to ordinary `step`,
properties or a locally successful promise. Accepting responses carry capability
`expectations-v1`, required by HTTP writers for these events, following the
existing attempts acknowledgment pattern. Proxies must fail closed for the
initial unsupported expectation path. A missing capability is a delivery failure;
a post-submission acknowledgment cannot undo an older server's accepted write.
Server HTTP expectation writes additionally require `X-Flowmark-Expectations: v1`
alongside the secret write credential. The server SDK sets it only for these
reports. This is an explicit protocol opt-in, not an independent credential or a
trusted browser source claim. The generic proxy never forwards caller headers
and rejects expectation event types, so an older proxy with a newer core schema
cannot accidentally attest these reports through its existing forwarding path.
Custom transports targeting `/v1/events` must set the marker themselves; direct
public-browser ingestion uses its own namespace/credential checks and needs no
extra CORS header. Custom transports own compatibility and must document it.

[Migration rollout](../migrations.md): verify locally, then approved exact-SHA
Preview migration/behavior, then the activated approved Staging merge pipeline
(migrate → API/readers → verify). Production belongs to an approved release.
Only after accepting storage/API/readers are available may users enable the new
SDK methods; aligned core/node publishing requires separate approval. This
implementation performs no hosted migration, deployment, retention-policy change
or publication without separate authorization.

## Implementation verification and storage ownership

TASK-014 implements the three event types, ordinary SDK methods and advanced
client factory, authenticated reads, full-cohort filtering/attention and dashboard
evidence. The generic proxy deliberately rejects the new events; direct browser
reports remain namespaced and untrusted. HTTP writers require `expectations-v1`.

Migrations `0013_mysterious_onslaught.sql` and `0014_icy_night_thrasher.sql` are
additive and must both precede the accepting code. Canonical receipts are marked
server-side; later semantic duplicates remain immutable audit receipts. A
nullable event owner points to its expectation identity anchor; canonical fact
references point back. Deleting a canonical fact or identity anchor cascades
through that expectation's owned receipts/projection, without deleting ordinary
run events. This prevents a dangling projection from becoming an archive of
expired evidence. Rebuild updates derived columns in place from canonical
receipts and their original observation times; do not truncate/delete identity
anchors as a cache rebuild. Incomplete canonical evidence is unavailable, not a
new deadline. No public rebuild or cleanup endpoint is added.

The persistence clock defaults to database observation and can be scoped with
Effect for deterministic isolated tests. There is no hosted/environment clock
override, scheduler or system-clock change. The test suite exercises boundary
clocks, duplicates, unmatched/concurrent reports, two-project/browser trust,
terminal immutability, retained ownership/rebuild and population counts beyond
the first 100 runs. Preview and release environment verification remain separate
rollout gates under the migration guide.
