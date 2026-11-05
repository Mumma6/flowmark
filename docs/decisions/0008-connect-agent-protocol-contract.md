# ADR 0008: Connect Your Agent — protocol, grant, client and tool contract

- Status: proposed
- Date: 2026-11-05
- Task: Agent TASK-001.2 (freeze issuer, grant, client and tool contracts)
- Depends on: [ADR 0007](./0007-connect-agent-mcp-dependencies.md) (dependency tranche)

## Context

ADR 0007 pins Better Auth MCP/OAuth packages without installing them. Connect
Your Agent still needs one **implementable** contract for routes, scopes, grant
binding, client registration, token lifetimes, tool names and read bounds so
later tasks do not invent competing auth designs.

This ADR is **decision/review only**. It does not install packages, migrate
Neon, enable hosted MCP, or implement tools.

Machine-readable constants live in
`packages/auth/src/agent-access/protocol-contract.ts`.

## Decision (proposal)

### Origins and route map

| Role                      | Origin source                                                               | Purpose                                                                                          |
| ------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Issuer / browser auth** | `BETTER_AUTH_URL` (same value as dashboard canonical origin in hosted envs) | OAuth discovery, `/oauth2/*`, `/jwks`, first-party session cookies, sign-in and consent pages    |
| **API / MCP resource**    | `FLOWMARK_API_URL` on dashboard; API server public URL in hosted envs       | `POST /mcp`, RFC 9728 protected-resource metadata on the **API host**, authorized tool execution |

Reference shapes (from `infrastructure/environments.md`):

| Profile    | Issuer (`BETTER_AUTH_URL`)         | API (`FLOWMARK_API_URL`)           | MCP resource identifier                |
| ---------- | ---------------------------------- | ---------------------------------- | -------------------------------------- |
| Production | `https://app.flowmark.dev`         | `https://api.flowmark.dev`         | `https://api.flowmark.dev/mcp`         |
| Staging    | `https://app.staging.flowmark.dev` | `https://api.staging.flowmark.dev` | `https://api.staging.flowmark.dev/mcp` |
| Local      | `http://localhost:3001`            | `http://localhost:3000`            | `http://localhost:3000/mcp`            |

Local MCP resource HTTP is allowed on loopback per `@better-auth/mcp` rules;
hosted resources require HTTPS.

**Issuer-visible paths** (executed on the API auth app; **dashboard proxy forwards**
narrow prefixes in TASK-003 — no widening of ordinary login redirect rules):

- Existing: `/api/auth/*` (unchanged)
- OAuth: `/oauth2/authorize`, `/oauth2/token`, `/oauth2/introspect`, `/oauth2/revoke`, `/oauth2/userinfo`, optional `/oauth2/register` if DCR is ever enabled
- Discovery: `/.well-known/oauth-authorization-server`, `/.well-known/openid-configuration`
- Keys: `/jwks` (Better Auth `jwt()` default)

**API-visible paths** (direct to API origin — **not** dashboard-proxied):

- Transport: `POST /mcp` (stateless MCP HTTP, `@modelcontextprotocol/server` v2, `legacy: "reject"`)
- Resource metadata: `GET /.well-known/oauth-protected-resource` for the configured resource URL

**Browser UX paths** (dashboard app routes; passed to `mcp({ loginPage, consentPage })`):

- Login: `/sign-in` (existing dashboard auth)
- Consent: `/connect/agent/consent` (TASK-006.2 implements UI; path frozen here)

`requireMcpAuth` on the API **must** override defaults:

```text
issuer   = issuerOrigin
resource = {apiOrigin}/mcp
jwksUrl  = {issuerOrigin}/jwks
requiredScopes = [flowmark:read]
```

### Scopes and token lifetimes

| Item                 | Frozen value         | Notes                                                                                                |
| -------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| Read scope           | **`flowmark:read`**  | Required on every MCP tool call                                                                      |
| Refresh              | **`offline_access`** | Provider OIDC semantics; visible on consent when refresh is requested                                |
| Access token TTL     | **10 minutes**       | Flowmark policy default at configuration time                                                        |
| Refresh family max   | **30 days**          | Upper bound for delegated connection lifetime                                                        |
| Refresh reuse window | **30 seconds**       | `@better-auth/mcp` default for retried refresh after rotation; set `0` only with explicit ADR change |

Access tokens must be **resource-bound** to `{apiOrigin}/mcp`. Wrong issuer,
audience, resource, scope, or environment must **fail closed** before evidence reads.

### Grant and project authority

Delegated access is **not** a session and **not** an ingestion key.

- One **connection** = one user + OAuth client + resource authorization **family**
  (provider consent/token records are canonical; Flowmark stores minimal project binding).
- **Up to 10 projects** per authorization version; sets are **explicit** and **immutable**
  for that version — no silent expansion when the user creates projects later.
- **Every project-scoped tool call** requires a **`projectId`** argument. **No** fallback
  to `AuthorizeProject.authorizeUser` default/first project and **no** promotion of MCP
  callers to the unrestricted **`User`** `ProjectReader` path used by dashboard tRPC.
- Effective access = **grant project list ∩ current membership** at invocation time.
- **Revocation** and grant expiry must be checked in **shared PostgreSQL state on every
  authorized MCP request**; JWT expiry alone is insufficient. Stale, expired, or revoked
  credentials fail closed (including refresh).
- Read tokens **must not** authorize ingestion, account/key management, declaration
  mutations, or grant administration via MCP.

Account lifecycle (password reset, disable, delete) **must** invalidate delegated grants
via hooks designed in TASK-004; dashboard sign-out ends the browser session only.

### PKCE, refresh, and revocation races

- **PKCE `S256` required** for public clients (OAuth 2.1 baseline).
- Authorization codes are single-use; provider handles replay detection.
- Refresh token rotation follows provider semantics; MCP plugin’s reuse interval applies
  only to legitimate retry after rotation — **refresh reuse abuse** remains a hard failure.
- In-flight reads after revocation may complete; **subsequent** checks and refresh must fail.

### Client registration and redirects

| Mechanism                     | Policy                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Primary**                   | **CIMD** with `metadataProfile: "mcp-2026-07-28"` and application-owned metadata fetch with SSRF protections |
| **DCR**                       | **Off by default**; enable only after TASK-008+ names a client that demonstrably requires it                 |
| **Predefined public clients** | Allowed for reference/self-host docs when CIMD is unavailable                                                |
| **Desktop config**            | **No client secrets** in copied `mcp.json` / snippets                                                        |

**Redirect policy:**

- Remote client metadata (name, logo, URIs) is **untrusted** until validated and stored in the provider transaction.
- **Native loopback** callbacks may use `http://127.0.0.1`, `http://localhost`, or `http://[::1]` with **registered redirect URIs only** — validated against the provider authorization record, not a global allowlist change.
- Dashboard proxy **continues to reject external `Location` redirects** on `/api/auth/*`. OAuth authorize responses that redirect to loopback or vendor HTTPS URLs are forwarded only through the **narrow `/oauth2/*` proxy path** approved in TASK-003, without relaxing CSRF/origin checks on ordinary login/recovery.

**Empirical verification** of each client’s registration and callback behavior is **deferred to Agent TASK-008** (named in the machine-readable contract).

### Six MCP tools (frozen names)

| Tool                    | Project-scoped | Reuse (implementation)                    |
| ----------------------- | -------------- | ----------------------------------------- |
| `get_connection`        | No             | Grant verification + granted project list |
| `list_workflows`        | Yes            | Bounded workflow discovery                |
| `find_runs`             | Yes            | History filters + cursor pages            |
| `get_run`               | Yes            | Compact run + paged events                |
| `compare_run`           | Yes            | Peer selection / comparison reads         |
| `get_workflow_insights` | Yes            | Period / business insight modes           |

Tools are **read-only** annotations; authorization is **server-side** on every call.
Implementations delegate to `@flowmark/api` bounded use cases — no SQL or privileged
keys inside the MCP adapter.

### Query, paging, and response bounds

| Bound                        | Value                                 |
| ---------------------------- | ------------------------------------- |
| Default page size            | 25                                    |
| Max page size                | 100                                   |
| Default event page           | 50                                    |
| Max event page               | 100                                   |
| Max history window           | **31 days** per query                 |
| Max insight window           | **31 days** per query                 |
| Default peer lookback        | 30 days (within existing peer limits) |
| Max serialized tool response | **64 KiB**                            |

Oversized records return **previews and explicit continuations**, never invalid JSON
or silent omission. Unsupported filter combinations **fail with a stated limitation** —
no broader substitute query.

### Admission budgets (provisional — separate from login limiter)

MCP and OAuth endpoints use **durable PostgreSQL limiters** patterned on existing auth
storage — **not** shared counters with email login. Initial Flowmark targets:

| Surface                   | Initial budget                |
| ------------------------- | ----------------------------- |
| OAuth authorize           | 60 / trusted source / minute  |
| OAuth token               | 120 / trusted source / minute |
| MCP tool calls            | 120 / grant family / minute   |
| Unauthenticated discovery | 300 / service / minute        |

Revocation remains available when creation/query budgets are exhausted. Exact key shapes
and SQL are owned by TASK-005.5 / TASK-004.

### Disabled and rollout behavior

Until the full path is enabled, the product continues to show **honest disabled**
agent access (no working OAuth/MCP claims). Feature activation is a separate gate
from accepting this contract.

## Compatibility with existing perimeter

Preserves:

- Signed proxy identity and source attribution on `/api/auth/*`
- Provider CSRF/origin checks
- Existing login/recovery URLs and cookie behavior
- Ingestion keys and session isolation boundaries documented in [auth-perimeter.md](../auth-perimeter.md)

Does **not** authorize package installation (still gated per ADR 0007).

## Consequences

- TASK-003 implements provider composition and proxy forwarding **exactly** from this map.
- TASK-004 owns grant persistence, revocation SQL, and lifecycle hooks.
- TASK-005 registers **only** these six tool names with the frozen bounds.
- TASK-008 owns empirical client verification listed in the contract export.
- Changes to scope strings, tool names, origin layout, or default lifetimes require a **new ADR**.

## References

- Dependencies: [ADR 0007](./0007-connect-agent-mcp-dependencies.md)
- Machine-readable: `packages/auth/src/agent-access/protocol-contract.ts`
- Perimeter: [Authentication boundaries](../auth-perimeter.md)
- Connect feature spec (maintainer-local `private/plans/connect-your-agent/SPEC.md`)
