# @flowmark/mcp

Private MCP adapter for Flowmark. It owns the protected HTTP transport, tool
registration, and the Effect services those handlers need. It is not published
to npm.

`apps/server` mounts the routes and supplies `McpHostConfiguration` and
`McpAuthGateway`. Workflow and connection reads stay in `@flowmark/api`.
OAuth, grant families, and issuer discovery stay in `@flowmark/auth`. This
package calls those use cases; it does not execute, schedule, or retry
application work.

Agent access stays off unless the deployment enables it. A disabled deployment
answers MCP HTTP with an explicit not-found response.

## Tools

| Tool                    | Behavior                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| `get_connection`        | Current grant, project scope, and which investigation tools this deployment enables.                           |
| `list_workflows`        | Workflow names in one authorized project. A `workflow` argument also loads bounded declaration meaning.        |
| `find_runs`             | Run history inside an explicit `startedAfter` / `startedBefore` window of at most 31 days.                     |
| `get_run`               | Compact run summary plus one page of events, related runs, expectations, or operations.                        |
| `compare_run`           | Existing peer comparison for one run. Optional `peers` uses the same selection as Studio.                      |
| `get_workflow_insights` | One mode per call: `technical` period report or `business` declared-result insights. Unsupported filters fail. |

`McpWorkflowTools` exposes the project-scoped tools. They read through
`GetProjectWorkflowData` with a delegated OAuth reader. Input is decoded with
Effect Schema. `PersistenceError` and the other tagged read failures stay in
the error channel and become MCP tool errors only at the response boundary.

Each token carries its own signed `flowmark_grant_family`. Reads check that
exact family's active resource binding in PostgreSQL, so a revoked token cannot
inherit a replacement connection. Tokens without this claim require fresh
authorization. Grant reads use the API's scoped database layer, which closes
connections on success, failure and interruption.

## HTTP

`createMcpHttpRoutes` returns the `POST /mcp` handler and the protected-resource
metadata handler. The server runs those effects with its own layer. The POST
handler validates the bearer token, then serves the streamable MCP session.
Clients start with the legacy `initialize` handshake. Follow-up requests send
`mcp-session-id` and accept both `application/json` and `text/event-stream`.

## Checks

```sh
pnpm --filter @flowmark/mcp test
pnpm --filter @flowmark/mcp typecheck
pnpm --filter @flowmark/mcp build
```

The protected HTTP flow is covered by `apps/server/test/http/mcp-agent-access.test.ts`,
which runs only when `TEST_DATABASE_URL` is set. Root `pnpm test:integration`
builds this package before those tests.

## Admission and execution bounds

Every tool call checks shared PostgreSQL admission: 3000/service, 120/grant and
600/authorized project per minute. Discovery has a separate 300/service budget.
Storage failure denies admission; revocation remains independent of read budgets.
Request bodies and full UTF-8 tool results are capped at 64 KiB. Tool execution
expires after 15 seconds, SQL statements after 5 seconds. Client interruption
cancels active SQL before pool cleanup. Oversized pages are read again with a
smaller limit and a new valid cursor. A single oversized record or more than
1000 operation facts per compared run returns an explicit limitation.

Studio exports a strict version-1 run selection from `@flowmarkdev/core`.
`runSelectionToolInput` converts it to `get_run` arguments. It carries identifiers
and paging only; the caller still needs its own active grant and membership.

## Disabled mode and diagnostics

Startup serves `POST /mcp` only when `FLOWMARK_AGENT_ACCESS_ENABLED=true` and
the API, issuer, and dashboard origins resolve. Otherwise the route and consent
bridge answer `404`. That is an unavailable deployment, not an empty connection.
`GET /mcp` stays `405` with `Allow: POST`; this adapter does not offer an SSE
transport. Unauthenticated calls answer `401` with a `WWW-Authenticate`
challenge and no evidence.

`initialize` follows the MCP SDK negotiation. A supported protocol revision is
echoed. An unsupported revision is not accepted as the session version; the
server selects a supported revision instead. This reference proof is the HTTP
adapter in `apps/server/test/http/mcp-agent-access.test.ts`. It does not claim
that Codex, Cursor, Claude, or any other vendor client is compatible.

Safe diagnostics stay fixed labels. Admission storage failure returns
`Read admission is unavailable.` and omits the driver cause. Request and
serialized tool results stop at 64 KiB. A page that does not fit is read again
at a smaller limit with that page's cursor. One record that still does not fit,
or a comparison above 1000 operation facts, returns an explicit limitation.
Tool execution expires after 15 seconds and SQL statements after 5 seconds.
No diagnostic includes the access token, raw event payload, or database error
text.

A `flowmark:read` token is not an ingestion key and not a dashboard session.
It cannot ingest events, create projects, or write result declarations. Project
arguments outside the grant are rejected before the read is treated as success.
Revocation is the persisted grant family, checked on the next authorized call.

## Optional MCP App run view

Compatible clients can render the read-only `get_run` events presentation through
`ui://flowmark/run-evidence/v1.html`. UI capability negotiation only selects a
presentation; it grants no authority. The existing six tools and their complete
text/structured results remain available without UI support. Live connection and
admission checks also protect static resource reads. No new public route, key or
REST client is required. Agent access's disabled mode remains authoritative.

The shared package documents [presentation and local synthetic verification](../evidence-view/README.md).
[ADR 0011](../../docs/decisions/0011-mcp-app-evidence-boundary.md) records the
approved protocol/dependency and host sandbox boundaries. Explicit refresh and
next-events-page actions invoke the same scoped `get_run` through the host and
repeat live admission/authorization. Negotiated clients see `get_run` as both
model- and app-visible. There is no polling, automatic retry or direct network
access. Failures clear evidence/actions and require a fresh host selection.
Authorization failures carry an additive `io.flowmark/evidence` metadata hint
without exposing causes or asserting whether access expired or was revoked.
The metadata-only view is not a business-safe redaction of the diagnostic result.
