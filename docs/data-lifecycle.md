# Erasing telemetry and deleting projects

In Studio, open **Settings → Data & privacy**. Only the sole project owner can
use these controls. Existing projects with multiple members are blocked until
shared ownership and transfer are supported.

Choose complete runs by internal IDs, or an exact workflow name and a half-open
UTC run-start interval. Erasure removes the complete selected run, including
events outside that interval, expectations, results, errors and derived facts.
Workflow metadata and private live selections remain; reopened selections may
show missing evidence. Project deletion additionally removes configuration,
credentials, selections, memberships and grant-project bindings. Other projects
and a nonempty workspace remain intact.

Review the counts and exact scope, type the project name and verify your current
password. A preview expires after five minutes; changes to the reviewed evidence
require a fresh preview. Cancelling a preview changes no project data or keys.
Export downloads are not yet available: preserve needed evidence before deletion.

## What happens after confirmation

All server API keys, including read keys, and browser ingestion keys become
invalid immediately. Normal project reads and writes stop while cleanup runs.
Each request performs one bounded transaction. Studio requests further batches
while open; **Pause after this batch** or closing the page stops continuation.
Reopen the same project's Data & privacy page and choose **Resume cleanup**.
Once confirmed, cleanup can be resumed, not cancelled or undone.

Progress counts raw events and complete runs removed. Other phases clear
expectations, facts, keys and configuration. A failed batch rolls back its own
work, preserves earlier committed progress and leaves access blocked. A failed
request is never reported as completed deletion. Status can show a batch failure;
retry through the same operation instead of issuing unrelated SQL or recreating
the project. A later application version must support the operation's persisted
contract version to resume it.

For telemetry erasure, create replacement keys after completion. Existing
unselected runs can continue with fresh keys. New run starts must be later than
both confirmation time and the latest erased start. This applies across the
project: historical/buffered starts before that boundary are rejected, and a
future-dated source clock can delay newly reported starts. Old keys and original
buffered starts cannot recreate erased evidence. An authorized owner deliberately
reporting content again with a fresh timestamp is new application-reported
evidence; Flowmark cannot verify the truth of that content.

Project deletion removes the final project row only after its children have been
drained. Its empty workspace grouping is removed under a lock. Deleting the last
project leaves the account available to create another one. Stale evidence links
grant no access. Account deletion and exports are separate features.

## Implementation and operational limits

The API uses session-only `dataLifecycle.preview`, `confirm`, `status`, `cancel`
and `resume` procedures. Possession of an operation ID grants no rights. Every
resume rechecks the immutable requesting user and sole project ownership.
Password checks have a separate five-attempt, fifteen-minute actor budget.
Mutation requests require the trusted Studio origin, in addition to session and
scope checks. Responses are private/no-store.

The runner uses PostgreSQL state, not a queue or a background Promise. A batch
handles at most 1,000 event/expectation/metric rows, 100 run/run-fact rows or 100
configuration/key rows, with a five-second statement limit, three-second lock
limit and ten-second work deadline. Cascading relationships are drained from
their leaves first. Project credential epochs invalidate keys in constant space;
the project write fence and in-transaction key check cover requests authenticated
before confirmation. Event projection triggers remain enabled.

Unused previews and completed records have logical expiry, with bounded,
traffic-driven physical pruning. Completed records expire after thirty days;
unfinished cleanup never expires into an unlocked project. Completed public
status drops workflow names and selections. This does not implement the separate
reference telemetry retention scheduler.

**Live-data deleted** describes the application database. It does not claim
instant removal of hosting logs, delivered email, downloaded copies or provider
backups. Before hosted activation, the operator must verify actual provider
retention, establish independently preserved suppression evidence for the entire
recoverable backup window, and document support/processor handling. No such
provider setting or backup operation is performed by this feature PR.

Restore only into isolation. Keep application access disabled, reapply every
newer erasure using the independently retained evidence, invalidate restored
credentials and expired auth material, verify raw and derived absence, then
review any proposed cutover. A suppression ledger restored from the same old
backup is insufficient. If the independent evidence is unavailable, keep the
restore isolated. Application rollback does not undo or substitute for erasure.

See [ADR 0015](./decisions/0015-complete-data-lifecycle.md) for the accepted
ownership, lifecycle and external-copy contract and remaining operational gates.
Feature implementation and disposable verification do not authorize hosted
migrations, real-data deletion, provider changes, backup restore or deployment.
