# Implementation status (public mirror)

This page summarizes capabilities that have landed in **this repository** for the
Connect Your Agent program and related Product 1.0 work. It mirrors the maintainer
**implementation order** through **Agent TASK-005.1** (inclusive). It does **not**
link to internal planning paths; task IDs match public ADRs and PR history.

For security and API boundaries, see [Authentication boundaries](./auth-perimeter.md)
and [ADR 0008](./decisions/0008-connect-agent-protocol-contract.md).

## Connect Your Agent — delivered so far

| Task      | Summary (what exists in tree)                                                                                                                                                                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **006.1** | Four-client setup guidance with a documented manual fallback (`apps/docs`, Connect).                                                                                                                                                                                                                                           |
| **007.1** | Safe run-context preview and copy flows in Connect UI.                                                                                                                                                                                                                                                                         |
| **007.2** | Manual issue and insight handoff entry points.                                                                                                                                                                                                                                                                                 |
| **001.1** | Pinned MCP/OAuth-related dependencies; [ADR 0007](./decisions/0007-connect-agent-mcp-dependencies.md).                                                                                                                                                                                                                         |
| **001.2** | Frozen protocol, grant, client and tool contract; machine-readable exports under `@flowmark/auth/agent-access`; [ADR 0008](./decisions/0008-connect-agent-protocol-contract.md).                                                                                                                                               |
| **002.1** | Bounded run investigation summary and paged run events for Studio reads via `@flowmark/api` / persistence.                                                                                                                                                                                                                     |
| **002.2** | Bounded nested run evidence (related runs, expectations, operations sections).                                                                                                                                                                                                                                                 |
| **002.3** | Bounded workflow and result-declaration discovery reads.                                                                                                                                                                                                                                                                       |
| **002.4** | Parity checks: bounded reads do not change existing analytics semantics (tests).                                                                                                                                                                                                                                               |
| **003.1** | Approved OAuth provider schema and discovery wiring in `@flowmark/auth` (`agentAccess`).                                                                                                                                                                                                                                       |
| **003.2** | Narrow dashboard proxy forwarding for issuer-only OAuth paths (`/.well-known/*`, `/oauth2/*`, `/jwks`); ordinary `/api/auth/*` redirects unchanged.                                                                                                                                                                            |
| **003.3** | Provider authorization-code exchange, refresh rotation, and MCP resource binding in tests (`packages/auth/test`).                                                                                                                                                                                                              |
| **003.4** | Regression: ordinary session and signup paths stay closed to provider tokens without a project grant (`packages/auth/test/agent-access-regression.test.ts`).                                                                                                                                                                   |
| **004.1** | **Delegated reader binding:** `agent_access_grant_projects` stores immutable project allowlists per OAuth grant family; workflow reads can use a `DelegatedUser` path that enforces **grant project list ∩ membership ∩ active refresh** (see [Authentication boundaries](./auth-perimeter.md#delegated-workflow-reads-trpc)). |

| **004.2** | Session-only consent and own-connection reads: list/detail connections, last-auth recording, `agentAccess` tRPC procedures, and consent submission that persists grant rows and intent state. |

| **004.3** | Transactional **revoke** for one connection (`agentAccess.revokeConnection`) or **all** delegated families after **password reset**; supersedes prior grant family on new consent; enum `oauth_consent_intent_state` includes `revoked`. |

| **004.4** | Integration coverage for delegated grant **isolation** (`getDelegatedReaderProject`, consent, revoke): wrong project, foreign grant rows, wrong user, removed membership, non-member consent rejection, concurrent consent, post-revoke denial. Runs when `TEST_DATABASE_URL` is set (`pnpm test:integration`). |
| **005.1** | **Protected MCP HTTP adapter (initial):** `POST /mcp` with Better Auth `createMcpProtectedRequestHandler`, stateless `@modelcontextprotocol/server` (`legacy: "reject"`), opted in via `FLOWMARK_AGENT_ACCESS_ENABLED=true`. Registers **`get_connection` only**; other six-tool names remain pending. OAuth tokens are verified before any grant read; `get_connection` returns granted projects ∩ membership and enabled/pending tool lists. Tests: `apps/server/test/http/mcp-agent-access.test.ts` (requires `TEST_DATABASE_URL`). |

## Product 1.0 — items completed in the same sequence window

These appear under “Completed” in the implementation order; they are part of the
current public tree, not future Connect tasks.

| Task / item     | Summary                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **SDK-001**     | Advanced workflow lifecycle shared in SDK docs and types.                                                                          |
| **003.1–003.6** | Studio shell, unified search, contextual run inspector, insights/issues in Explore, proxy failure recovery, responsive acceptance. |
| **006.1**       | Instrumentation prompt aligned with SDK release notes.                                                                             |
| **006.2**       | Working agent and manual setup surfaces in Connect.                                                                                |
| **011**         | Landing narrative for Product 1.0 positioning.                                                                                     |
| **006.4**       | Independent instrumented setup example verified (PR **#119**); demo path documented for contributors.                              |

## Explicitly not done here

- Items after **Agent TASK-005.1** in the implementation order (remaining MCP
  investigation tools, budgets, and later Product/Access tasks) are **not**
  described as shipped on this page until they merge.
- **Cancelled:** Product TASK-006.3 (first persisted evidence as a Studio gate) —
  do not treat persisted telemetry as an access prerequisite; see implementation order notes.

## How to extend this page

When a numbered item from the maintainer implementation order merges, add a row
under the appropriate table with a **short, public** description and link ADRs or
`docs/` only. Do not reference ignored planning paths in the public repo.
