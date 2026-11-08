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
