# ADR 0010: First public run read

- Status: proposed; requires maintainer acceptance before implementation
- Date: 2026-11-10
- Task: Product TASK-007.1
- Baseline: `7b61f56` on `staging`

## Consumer and decision

A server-side TypeScript CLI answers: **“For this selected run, what status and
duration were last reported, and which events were recorded?”** The user supplies
the run selection copied from Studio and a project read key through environment
configuration. The CLI prints one event page and a link back to Studio; an
explicit next-page action reuses the returned cursor. It never polls or executes
application work.

Add one HTTP read and one ordinary Promise client in the existing Node SDK.
Do not create a new package, query language or OAuth resource. This is a technical
evidence read, not an approved business-safe projection or a captured snapshot.

## Request and authority

`POST {apiBaseUrl}/v1/read/run`, `Content-Type: application/json`, with
`Authorization: Bearer <project-read-key>`. The body is the existing
[versioned run selection](0009-versioned-run-investigation-selection.md), restricted
to `section: "events"`:

```json
{
  "version": 1,
  "kind": "run",
  "projectId": "00000000-0000-4000-8000-000000000001",
  "runId": "00000000-0000-4000-8000-000000000002",
  "section": "events",
  "limit": 50
}
```

Project/run IDs are internal UUIDs. Omitted limit means 50; valid limits are
integers 1–100. Optional cursor is a nonempty string of at most 2048 characters.
Reject unknown properties, invalid limits and unsupported selections; never
silently discard a filter or clamp an invalid request. Other sections, period
queries, peers, revisions and environment filters are unsupported in this first
endpoint. Their existing Studio/MCP implementations remain available.

Authenticate using `AuthorizeProject.authorize(header, "read")`: the current
credential store compares the exact permission and already excludes write keys.
Explicitly reject demo credentials even in demo mode. Browser keys, cookies,
session tokens, MCP OAuth tokens and caller-supplied delegated identity headers
do not authenticate this endpoint. Never fall back to a user's first project.
Delegated readers continue to use MCP with its existing verified `/mcp` audience;
accepting them here requires a separately reviewed resource/auth contract.

Compare the authenticated project with `selection.projectId` before querying
evidence. A mismatch returns 403 without testing that project's existence. Within
the authorized project, a nonexistent or foreign run returns the same 404. Check
the live key on every request, including every page; revocation denies subsequent
requests. An already authorized request is not a historical snapshot or a promise
of synchronous cancellation on key deletion.

Read-key issuance is a prerequisite for a usable consumer: storage already
supports `permission: "read"`, but project management currently exposes only
`createWriteKey`. The implementation slice must add session-authorized
`ManageProject.createReadKey` / `project.createReadKey` and a settings action,
reusing current membership, key-creation quotas, one-time secret display and
project-scoped revocation. Do not add public key-management endpoints, use raw SQL
to provision keys, or substitute an ingestion key.

## Public DTOs

These are **planned names and wire types**, not current exports. Define the data
schemas/types in `packages/core/src/public-read.ts` and export them through core's
existing entry point: `RunReadInputSchema` / `RunReadInput`,
`RunReadResponseSchema` / `RunReadResponse`, and
`RunReadErrorSchema` / `RunReadError`. Input reuses the existing selection schema
and narrows its section; do not duplicate its UUID/version rules.

```ts
type RunReadInput = {
  version: 1
  kind: "run"
  projectId: string
  runId: string
  section: "events"
  cursor?: string
  limit?: number
}

type RunReadResponse = {
  version: 1
  selection: RunReadInput & { limit: number }
  observedAt: string
  summary: {
    id: string
    workflow: string
    status: "Running" | "Completed" | "Failed"
    startedAt: string
    durationMs: number | null
    eventCount: number
  }
  page: {
    events: Array<{
      id: string
      type: string
      timestamp: string
      durationMs: number | null
    }>
    limit: number
    totalEvents: number
    nextCursor: string | null
  }
  evidence: { runPath: string }
  omissions: string[]
}

type RunReadError = {
  version: 1
  error: {
    code: string
    message: string
    retryAfterSeconds: number | null
  }
}
```

All dates are UTC ISO 8601 strings. Numeric fields must be finite; counts are
nonnegative integers. Status/duration/counts retain the existing run-summary
semantics; event type is an opaque string, including unfamiliar future types.
Event IDs and timestamps match the existing event page, not a derived timeline.
`observedAt` is response construction time, not the time of the last event.
Summary, count and page are live observations, potentially made by separate
queries. Concurrent ingestion may make their counts differ; no atomic snapshot
is promised. A `Running` status does not prove current activity; completed does
not prove business correctness. A null duration means no reported duration.

Expected response to the request above (synthetic evidence):

```json
{
  "version": 1,
  "selection": {
    "version": 1,
    "kind": "run",
    "projectId": "00000000-0000-4000-8000-000000000001",
    "runId": "00000000-0000-4000-8000-000000000002",
    "section": "events",
    "limit": 50
  },
  "observedAt": "2026-11-10T10:00:00.000Z",
  "summary": {
    "id": "00000000-0000-4000-8000-000000000002",
    "workflow": "invoice-review",
    "status": "Running",
    "startedAt": "2026-11-10T09:59:00.000Z",
    "durationMs": null,
    "eventCount": 1
  },
  "page": {
    "events": [
      {
        "id": "00000000-0000-4000-8000-000000000003",
        "type": "started",
        "timestamp": "2026-11-10T09:59:00.000Z",
        "durationMs": null
      }
    ],
    "limit": 50,
    "totalEvents": 1,
    "nextCursor": null
  },
  "evidence": {
    "runPath": "/runs/00000000-0000-4000-8000-000000000002?selection=%7B%22version%22%3A1%2C%22kind%22%3A%22run%22%2C%22projectId%22%3A%2200000000-0000-4000-8000-000000000001%22%2C%22runId%22%3A%2200000000-0000-4000-8000-000000000002%22%2C%22section%22%3A%22events%22%2C%22limit%22%3A50%7D"
  },
  "omissions": ["event_payloads", "business_results"]
}
```

The stable omission identifiers above describe intentional absence, not truncated
success or a privacy guarantee. Do not expose properties, error stacks, results,
external IDs or arbitrary metadata in this DTO. Existing run with no retained
events returns 200, `events: []`, `totalEvents: 0`, `nextCursor: null`; a missing
run is never an empty success. `runPath` must match Studio's existing project/run
navigation helper and preserve explicit scope; it confers no permission.

## Paging and resource bounds

Reuse ascending `(occurredAt, createdAt, eventId)` ordering and the existing
opaque cursor representation, preserving SQL timestamp microseconds. Do not
round-trip cursor positions through JavaScript dates. A page fetch selects at
most `limit + 1` event rows and returns at most `limit`; the next cursor refers
to the last returned event only when more evidence exists.

The current cursor parser is not scope-bound. Before fetching a continuation,
validate its UUID/timestamp syntax and confirm that its event ID and both exact
timestamps identify an anchor in the authorized project/run. Reject malformed,
foreign, altered or deleted-anchor cursors with `INVALID_CURSOR`, never restart
silently. An anchor check is permitted scoped validation, not a page/payload read.
This preserves Studio/MCP cursor portability without a signing secret or a new
cursor authority model. A user may explicitly restart after retention removes
the anchor. Later inserts after the position may appear; earlier late arrivals
require a fresh traversal. Paging is not an immutable export.

Stream requests into at most 8 KiB. Cap one serialized JSON response at 64 KiB
UTF-8, with a 15-second whole-request deadline and a 5-second PostgreSQL statement
timeout. Propagate request cancellation into the Effect scope and database
interruption; merely racing a Promise is insufficient. Response size overflow
returns `EVIDENCE_TOO_LARGE`, never partial JSON or success-shaped truncation.
The client uses the same 15-second deadline across fetch and body consumption
and checks streamed response bytes before parsing, even without Content-Length.

Fetch only the allowlisted SQL columns. Existing `runEventPage` fetches JSON
before bounding its preview, and `runInvestigationSummary` fetches a full
`StoredRun`: projecting these objects after retrieval would not bound payload
transfer. Add metadata-only projections behind the existing workflow repository;
reuse current summary SQL/status/count semantics and project predicates rather
than introducing new analytics. Full counts remain aggregates, not capped samples,
and are subject to statement timeout.

Use durable, atomic admission with a separate public-read namespace: 3000
requests/service/minute before credential lookup, then 600/project/minute and
120/authenticated key/minute before evidence reads. Reuse the existing admission
mechanism, not MCP/OAuth counters or in-memory per-process limits. Invalid keys
must not allocate an unbounded series of limiter identities. Deny on limiter
storage failure; return 429 with `Retry-After` on exhaustion.

## HTTP errors and compatibility

All endpoint responses use JSON and `Cache-Control: no-store`; errors use the
envelope above and safe messages without SQL, keys or driver details. Set
`retryAfterSeconds` to a positive integer for 429 and null otherwise.

| HTTP | Codes                                                                               | Meaning                                                                        |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 400  | `INVALID_REQUEST`, `UNSUPPORTED_VERSION`, `UNSUPPORTED_SELECTION`, `INVALID_CURSOR` | Malformed JSON/schema/cursor; unknown version; unsupported kind/section/filter |
| 401  | `UNAUTHORIZED`                                                                      | Missing, invalid, revoked or wrong credential type                             |
| 403  | `PROJECT_FORBIDDEN`                                                                 | Authenticated read key does not match requested project                        |
| 404  | `RUN_NOT_FOUND`                                                                     | No matching run in authorized project                                          |
| 405  | `METHOD_NOT_ALLOWED`                                                                | Method other than POST; include `Allow: POST`                                  |
| 413  | `REQUEST_TOO_LARGE`                                                                 | Request exceeds 8 KiB                                                          |
| 415  | `UNSUPPORTED_MEDIA_TYPE`                                                            | Body is not JSON                                                               |
| 422  | `EVIDENCE_TOO_LARGE`                                                                | Allowed evidence cannot fit response budget                                    |
| 429  | `RATE_LIMITED`                                                                      | Admission budget exhausted                                                     |
| 503  | `READ_UNAVAILABLE`                                                                  | Storage/admission unavailable or unexpected internal failure                   |
| 504  | `READ_TIMEOUT`                                                                      | Execution deadline or statement timeout                                        |

Transport/body size checks precede authentication; authenticate before semantic
selection validation, then compare project, validate run/cursor, and read. For an
authenticated body, version errors precede unsupported modes/fields, which
precede remaining shape errors. Cancellation produces no fabricated response.

The URL major and body version must both be 1. Responses may gain optional
fields; clients ignore unknown response fields. Requests remain strict. Changes
to authority, existing meanings, field types/nullability, status enum or cursor
semantics require review and a new major when incompatible. Other read modes
are not implied by this endpoint and need their own accepted consumer contract.

## Client and implementation handoff

Planned SDK subpath: `@flowmarkdev/node/read`, backed by
`packages/sdk/src/reads/index.ts`. Export `createFlowmarkReadClient`,
`FlowmarkReadClient`, `FlowmarkReadError` and the three public DTO types above.
No AppRouter, database or Effect types appear in the client signature:

```ts
createFlowmarkReadClient(options: {
  apiBaseUrl: string
  readKey: string
}): FlowmarkReadClient

interface FlowmarkReadClient {
  readRun(input: RunReadInput, options?: { signal?: AbortSignal }): Promise<RunReadResponse>
}
```

`FlowmarkReadError extends Error` exposes `code: string`, `status: number | null`
and `retryAfterSeconds: number | null`. Local failures use `ABORTED`,
`READ_TIMEOUT`, `NETWORK_ERROR` or `INVALID_RESPONSE`, with null status when no
HTTP response exists. Validate success responses. Preserve unknown server error
codes safely; never substitute empty evidence. Do not retry automatically.

Require explicit HTTPS API base URL; allow HTTP only for loopback development.
Reject URL credentials, query and fragment. Preserve a self-hosted base path
when appending `v1/read/run`; do not infer cloud hosts. Disable redirects and use
`credentials: "omit"`. Keep read keys out of browser code, command-line arguments,
URLs and diagnostics. No browser CORS enablement is implied.

Implement `ReadPublicRun` in `packages/api/src/features/public-reads/` as the
authority/orchestration boundary over existing project authorization and workflow
repository ports. `apps/server` owns only HTTP/JSON adaptation. Core owns wire
schemas; DB owns scoped projections/anchor validation; SDK owns fetch and public
Promise errors. Exact new internal repository method names may follow local
conventions, but must be recorded in completion notes before later consumers.

Add `examples/read-run.ts` and its local typecheck alias for the SDK subpath.
Read the key from environment and the selection from a JSON file; optionally
accept an explicit Studio base URL to resolve the returned relative evidence
path. Never fetch that link or assume the Studio/API origins match. Demonstrate
one page, explicit continuation, empty evidence and error recovery. Publication,
hosted configuration and additional endpoints are separate operations.

## Review traces and required implementation proof

- **Success:** valid read key for A + A/run R => current summary and metadata
  page equivalent to Studio for R; unchanged shared selection, cursor and limit.
- **Denied:** write/browser/demo/session/MCP bearer => 401 before evidence;
  read key A + requested B => 403; A + foreign/missing R => identical 404.
- **Cursor:** valid same-run anchor continues in tuple order; foreign, altered,
  malformed and deleted anchors fail 400; same-timestamp events keep stable UUID
  ordering and microseconds. An exhausted page is a valid empty 200.
- **Unsupported:** version 2 => `UNSUPPORTED_VERSION`; period/related/revision
  => `UNSUPPORTED_SELECTION`; limits 0/101 and unknown invalid shapes fail 400.
- **Race/unknown:** revoked key rejects the next page; concurrent append does
  not freeze counts; late arrivals/retention follow the rules above. Unknown
  event types render as text, unknown response fields are ignored, malformed
  success bodies fail client validation.
- **Bounds:** huge stored JSON never leaves Postgres for this read; prove
  request/response byte caps, statement interruption, caller abort and durable
  admission failure/exhaustion over actual HTTP and the ordinary TS client.

These are source-reviewed traces and required future tests, **not executed
endpoint proof**. Existing source anchors are `investigation-selection.ts`,
`AuthorizeProject`, `authenticate-key.ts`, `get-run-investigation-summary.ts`,
`get-run-event-page.ts`, `run-event-page-cursor.ts` and `ManageProject`. Preserve
[ADR 0008's](0008-connect-agent-protocol-contract.md) independent MCP audience
and existing bounded-read semantics. No runtime exports or endpoints are added
by this ADR.
