# Run continuation and terminal policy

TASK-003 decision, accepted by the maintainer on 31 October 2026: the first
terminal event accepted by persistence wins for future appends. Stored history
is not rewritten. No compatibility switch or historical backfill is introduced.

## Transitions and acknowledgments

| Existing evidence | Incoming event                                    | Decision                                                 |
| ----------------- | ------------------------------------------------- | -------------------------------------------------------- |
| No start          | Any non-start                                     | HTTP 409, RUN_NOT_FOUND                                  |
| Any run           | Existing event ID in this run                     | HTTP 202, duplicate; payload is not amended              |
| Open              | New start ID                                      | HTTP 202, ignored; original metadata is immutable        |
| Open              | Step, context, progress, report, operation, error | HTTP 202, recorded                                       |
| Open              | Completed or failed                               | HTTP 202, recorded; closes the run                       |
| Closed            | New completed or failed ID                        | HTTP 409, conflict; stored outcome/result stay unchanged |
| Closed            | Other new marker                                  | HTTP 202, ignored; run stays closed                      |
| Any run           | Event ID already belonging to another run         | HTTP 409, conflict; no foreign details exposed           |

HTTP 202 includes `accepted` and `disposition` (`recorded`, `duplicate`,
`ignored`). Accepted is false for ignored events. HTTP 409 conflicts include
`accepted: false`, `disposition: "conflict"`, and `code: "EVENT_CONFLICT"`.
Retries must reuse the original envelope event ID. A callback with a new ID is
new evidence, even if it repeats the same terminal kind or payload.

Envelope identities use a transaction-scoped advisory lock before any run rows
are created, so rejected/colliding starts leave no phantom runs. All run decisions
are serialized under the existing run-row transaction lock before
checking stored evidence and inserting events. Application timestamps do not
choose the winning terminal. No database/schema migration is required.

## Local handles and requests

A local handle suppresses markers after terminal completion; it does not read
remote state. Independent handles may each attempt a terminal, and the server
accepts only the first. Conflicts use existing SDK delivery diagnostics and
explicit flush/shutdown failures. HTTP 409 is not retried. Application return
values and original errors are preserved. Next drains through after; browser
clients keep their existing proxy/direct delivery lifecycles.

A local done request waits only for that handle's open operations. Until it
emits its terminal event, fail may supersede pending completion. Another handle
can close the run first; the pending terminal then conflicts when delivered.
Closing operations never coordinates application work across handles.

Continue with the same workflow name and external run ID. Transport a plain
WorkflowRunReference explicitly through application-owned storage/payloads;
correlation/parent IDs do not resume a run. Repeated starts do not change initial
properties, environment, release or links. Use setProperties for accepted shallow
context changes while the run is open. A new attempt gets a new run ID.

## Compatibility and historical interpretation

Previously, a later failed event could supersede completed on the server, while
one local SDK handle already treated completion as terminal. After this change,
new conflicting terminal appends are rejected on both existing and new runs.
Old stored runs that contain both kinds remain failed under the established
read projection; no stored result, outcome or event is reinterpreted.

Old wire envelopes still validate. Existing clients also see terminal conflicts
as non-retryable HTTP 409 delivery failures. New receipt fields are additive;
the proxy preserves real older-server accepted responses without inventing a
disposition. The first-terminal policy is a backend requirement: an older server
still applies its old rules. Deploy accepting backend/proxy readers before
relying on the new behavior. Package publication is a separate release operation.

Reports remain non-final and cannot be appended after termination. Terminal
completion never fulfills or cancels expectations. The planned
[expectation contract](./expectations.md) specifies TASK-014's narrowly scoped
post-terminal settlement channel; it is not implemented by the contract note.
