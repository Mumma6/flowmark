# Implementation status (public mirror)

This page summarizes capabilities that have landed in **this repository** for the
Connect Your Agent program and related Product 1.0 work. It mirrors the maintainer
**implementation order** through **Agent TASK-005.4** (inclusive). It does **not**
link to internal planning paths; task IDs match public ADRs and PR history.

For security and API boundaries, see [Authentication boundaries](./auth-perimeter.md)
and [ADR 0008](./decisions/0008-connect-agent-protocol-contract.md).

## Connect Your Agent — delivered so far

| Task      | Summary (what exists in tree)                                                                                                                                                                                                                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **006.1** | Four-client setup guidance with a documented manual fallback (`apps/docs`, Connect).                                                                                                                                                                                                                                                     |
| **007.1** | Safe run-context preview and copy flows in Connect UI.                                                                                                                                                                                                                                                                                   |
| **007.2** | Manual issue and insight handoff entry points.                                                                                                                                                                                                                                                                                           |
| **007.3** | The same run, failure-group, and insight handoffs include exact MCP tool arguments when remote read access is enabled. A copied prompt does not grant access or widen an unsupported selection. Manual handoff remains when access is disabled.                                                                                          |
| **001.1** | Pinned MCP/OAuth-related dependencies; [ADR 0007](./decisions/0007-connect-agent-mcp-dependencies.md).                                                                                                                                                                                                                                   |
| **001.2** | Frozen protocol, grant, client and tool contract; machine-readable exports under `@flowmark/auth/agent-access`; [ADR 0008](./decisions/0008-connect-agent-protocol-contract.md).                                                                                                                                                         |
| **002.1** | Bounded run investigation summary and paged run events for Studio reads via `@flowmark/api` / persistence.                                                                                                                                                                                                                               |
| **002.2** | Bounded nested run evidence (related runs, expectations, operations sections).                                                                                                                                                                                                                                                           |
| **002.3** | Bounded workflow and result-declaration discovery reads.                                                                                                                                                                                                                                                                                 |
| **002.4** | Parity checks: bounded reads do not change existing analytics semantics (tests).                                                                                                                                                                                                                                                         |
| **003.1** | Approved OAuth provider schema and discovery wiring in `@flowmark/auth` (`agentAccess`).                                                                                                                                                                                                                                                 |
| **003.2** | Narrow dashboard proxy forwarding for issuer-only OAuth paths (`/.well-known/*`, `/oauth2/*`, `/jwks`); ordinary `/api/auth/*` redirects unchanged.                                                                                                                                                                                      |
| **003.3** | Provider authorization-code exchange, refresh rotation, and MCP resource binding in tests (`packages/auth/test`).                                                                                                                                                                                                                        |
| **003.4** | Regression: ordinary session and signup paths stay closed to provider tokens without a project grant (`packages/auth/test/agent-access-regression.test.ts`).                                                                                                                                                                             |
| **004.1** | **Delegated reader binding:** `agent_access_grant_projects` stores immutable project allowlists per OAuth grant family; workflow reads can use a `DelegatedUser` path that enforces **grant project list ∩ membership ∩ active refresh** (see [Authentication boundaries](./auth-perimeter.md#delegated-workflow-reads-trpc)).           |
| **004.2** | Session-only consent and own-connection reads: list/detail connections, last-auth recording, `agentAccess` tRPC procedures, and consent submission that persists grant rows and intent state.                                                                                                                                            |
| **004.3** | Transactional **revoke** for one connection (`agentAccess.revokeConnection`) or **all** delegated families after **password reset**; supersedes prior grant family on new consent; enum `oauth_consent_intent_state` includes `revoked`.                                                                                                 |
| **004.4** | Integration coverage for delegated grant **isolation** (`getDelegatedReaderProject`, consent, revoke): wrong project, foreign grant rows, wrong user, removed membership, non-member consent rejection, concurrent consent, post-revoke denial. Runs when `TEST_DATABASE_URL` is set (`pnpm test:integration`).                          |
| **005.1** | **Protected MCP HTTP adapter:** `@flowmark/mcp` + thin `apps/server` transport; `POST /mcp`, RFC 9728 metadata, `get_connection` via delegated grant ∩ membership. Tests: `apps/server/test/http/mcp-agent-access.test.ts` (requires `TEST_DATABASE_URL`).                                                                               |
| **005.2** | **Workflow discovery and run finder MCP tools:** `list_workflows` and `find_runs` in `@flowmark/mcp` delegate to `GetProjectWorkflowData` with `DelegatedUser`; Standard Schema inputs, optional workflow meaning reads, explicit 31-day history window on `find_runs`. Schema tests: `packages/mcp/test/tool-schemas.test.ts`.          |
| **005.3** | **Compact run and peer comparison MCP tools:** `get_run` returns a summary plus one bounded section page (`events`, `related`, `expectations`, or `operations`). `compare_run` reuses `GetProjectWorkflowData.compare` and `PeerSelection`. Recorded duration and operation status stay distinct from wall time and terminal run status. |
| **005.4** | **Workflow insight MCP modes:** `get_workflow_insights` delegates `technical` to `periodReport` and `business` to `businessInsights`. Mixed mode fields and unsupported aggregate filters, including `environment`, fail closed. Coverage stays on the existing aggregate.                                                               |
| **005.5** | Durable PostgreSQL service/grant/project admission, request/result budgets, driver cancellation and statement deadlines. Oversized pages regenerate valid cursors; oversized comparison fact sets fail explicitly.                                                                                                                       |
| **005.6** | Reference HTTP client discovers and calls all six read-only tools over synthetic evidence, matching Studio use-case results. Disabled mode, unsupported protocol negotiation, wrong project/resource, revocation, response bounds and read-token denial of ingestion and account writes are covered. Vendor clients are not claimed.     |
| **006.2** | Provider-backed browser consent with explicit account/project selection, signed-query verification and pre-exchange code-family binding. Local provider integration covers acceptance, denial and account/project tampering.                                                                                                             |
| **006.3** | Connect shows the deployment's protected-resource endpoint when it is enabled. Copied instructions, an authorization grant, and grant-wide authentication stay separate. Connection authentication does not claim a successful evidence read for the current project.                                                                    |
| **006.4** | The signed-in account can inspect and revoke its own agent connections. Confirmation follows a fresh server read after cancelling older polls. A lost confirmation can be refreshed without resending revoke. A foreign account cannot revoke the family. Last authenticated request is shown as a UTC day.                              |
| **006.5** | Connected recovery keeps a disabled manual guide, a stale session, a cancelled consent, and a lost revoke response distinct. Vendor client compatibility is not claimed; the reference HTTP client remains the tested path.                                                                                                              |

## Product 1.0 — items completed in the same sequence window

These appear under “Completed” in the implementation order; they are part of the
current public tree, not future Connect tasks.

| Task / item     | Summary                                                                                                                                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SDK-001**     | Advanced workflow lifecycle shared in SDK docs and types.                                                                                                                                                                                                                   |
| **003.1–003.6** | Studio shell, unified search, contextual run inspector, insights/issues in Explore, proxy failure recovery, responsive acceptance.                                                                                                                                          |
| **006.1**       | Instrumentation prompt aligned with SDK release notes.                                                                                                                                                                                                                      |
| **006.2**       | Working agent and manual setup surfaces in Connect.                                                                                                                                                                                                                         |
| **011**         | Landing narrative for Product 1.0 positioning.                                                                                                                                                                                                                              |
| **006.4**       | Independent instrumented setup example implemented (PR **#119**); memory/runtime checks passed. Loopback/Studio acceptance remains pending.                                                                                                                                 |
| **001.1**       | Strict version-1 run selection shared by Studio and MCP; real protocol reads match Studio summary/events. [ADR 0009](./decisions/0009-versioned-run-investigation-selection.md).                                                                                            |
| **001.3**       | One technical period cohort maps to the same period report and current-window run list in Studio and MCP. Revision, environment and peer windows outside 1–90 days stay rejected. A return link keeps the current project and filters. Separate reads are not one snapshot. |

Product TASK-007.2 adds the source implementation of `POST /v1/read/run`,
`ReadPublicRun`, metadata-only scoped repository reads, read-key issuance in
Settings and the ordinary `@flowmarkdev/node/read` Promise client/standalone
consumer. [Public read guide](./sdk/public-run-read.md) records the auth and
resource bounds. Hosted rollout and SDK publication are separate; source
availability does not claim either has occurred.

Product TASK-007.3 adds `POST /v1/read/period` and `client.readPeriod` for one
accepted technical workflow-period comparison. The existing CLI consumes the
same Studio/MCP selection, with query echo, full window populations, explicit
coverage/omissions and a scoped Studio link. The shared SQL is filtered before
aggregation; the public query fetches two aggregate rows without attribution
lists. Peer/business modes, revisions and extra filters stay explicitly
unsupported by this read. [Guide](./sdk/public-period-read.md).

## Verification status

The implementation rows describe source availability, not blanket acceptance.
Session-only connection management still needs its full handler-level denial and
failure matrix. The setup example still needs its documented loopback/Studio pass.
OAuth exchange/refresh, exact token-family binding, revoke/reconnect denial,
immutable project scope and tied-timestamp operation pagination are covered by
managed disposable PostgreSQL integration tests.

## Explicitly not done here

- Vendor-client compatibility remains a separate gate. The reference HTTP
  client acceptance does not activate hosted agent access.
- **Cancelled:** Product TASK-006.3 (first persisted evidence as a Studio gate) —
  do not treat persisted telemetry as an access prerequisite; see implementation order notes.

## How to extend this page

When a numbered item from the maintainer implementation order merges, add a row
under the appropriate table with a **short, public** description and link ADRs or
`docs/` only. Do not reference ignored planning paths in the public repo.
