# ADR 0007: Connect Your Agent — MCP and OAuth dependency proposal

- Status: proposed
- Date: 2026-11-05
- Task: Agent TASK-001.1 (dependency compatibility decision)

## Context

Flowmark runs **Better Auth 1.7.13** with email/password only (`@flowmark/auth`,
`apps/server`). There is **no** configured OAuth provider, MCP endpoint, or
`@modelcontextprotocol/*` dependency in the monorepo today. Connect Your Agent
requires a maintained OAuth 2.1 authorization server and stateless MCP HTTP
transport without a bespoke token issuer or duplicate provider stack.

Official references checked on 5 November 2026:

- [Better Auth MCP plugin](https://better-auth.com/docs/plugins/mcp)
- [Better Auth 1.7 release notes (MCP package split)](https://better-auth.com/blog/1-7)
- [MCP authorization (2026-07-28 profile)](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization)
- npm registry metadata for `@better-auth/mcp@1.7.17` and `@modelcontextprotocol/server@2.4.0`

Installed-tree review: `better-auth@1.7.13` in the lockfile does **not** export
an MCP plugin; MCP moved to **`@better-auth/mcp`** starting in the 1.7 line.

## Decision (proposal — packages not installed by this ADR)

Adopt a **single reviewed dependency tranche** before any OAuth/MCP implementation.
Do **not** install or upgrade until a maintainer explicitly approves this tranche
and any coupled persistence work.

| Package                        | Proposed pin | Role                                                                     |
| ------------------------------ | ------------ | ------------------------------------------------------------------------ |
| `better-auth`                  | **1.7.17**   | Core auth; upgrade from 1.7.13                                           |
| `@better-auth/drizzle-adapter` | **1.7.17**   | Must match core                                                          |
| `@better-auth/mcp`             | **1.7.17**   | OAuth 2.1 AS + MCP resource binding (`mcp()` plugin)                     |
| `@better-auth/cimd`            | **1.7.17**   | Client ID Metadata Documents for MCP 2026-07-28 profile                  |
| `@modelcontextprotocol/server` | **2.4.0**    | Stateless MCP HTTP handler (`legacy: "reject"`, profile **2026-07-28**)  |
| `zod`                          | **^4.2.0**   | Required by `@modelcontextprotocol/server@2.4.0` (server/MCP shell only) |

**Rejected without a new ADR:**

- **Better Auth 1.8 beta** — pre-release; not for production agent access.
- A **custom JWT/OAuth issuer** outside Better Auth.
- A **second OAuth provider plugin** alongside `mcp()` (`oauthProvider()` must not be registered separately).
- **Dynamic Client Registration** by default — MCP profile prefers CIMD; enable DCR only after a documented client need in TASK-001.2.
- Treating **upstream examples** or **Vercel MCP handler blog posts** as compatibility proof.

### Auth upgrade and persistence coupling

`@better-auth/mcp@1.7.17` peers require `better-auth ^1.7.17` and
`@better-auth/oauth-provider ^1.7.17`.

`@better-auth/drizzle-adapter@1.7.17` peers require **`drizzle-orm ^0.45.2`**
( Flowmark is on **0.44.x** today). The auth bump and Drizzle bump must land in
one reviewed change with `@flowmark/db` migration/generator verification — not
as an silent transitive upgrade during MCP install.

The MCP plugin requires the Better Auth **`jwt()`** plugin (JWKS for resource
verification). Disable JWT routes that would collide with OAuth access tokens
per upstream MCP docs.

### Provider capabilities assumed (to verify in TASK-001.2)

- OAuth discovery and authorization under **`/oauth2/*`** (legacy `/mcp/*` OAuth paths moved in 1.7 MCP split).
- RFC 9728 **protected resource metadata** for `{apiOrigin}/mcp`.
- Resource-bound access tokens with **`flowmark:read`** (exact scope string frozen in TASK-001.2).
- Refresh handling via provider semantics; **`refreshTokenReuseInterval`** defaults documented in upgrade guide.
- **Schema extension** for OAuth clients/consent/grants — provider-owned tables only; follow Better Auth migration guide (clients not auto-copied from legacy tables).

### Route and origin sketch (compatibility target)

Dashboard-facing **issuer/base URL** stays the existing Better Auth base
(`BETTER_AUTH_URL` / dashboard origin). API **resource** stays the existing API
origin plus **`/mcp`**.

```text
Browser login + consent     → dashboard origin (existing cookies, CSRF, proxy rules)
OAuth AS metadata + flows   → {issuer}/oauth2/*  (Better Auth + @better-auth/mcp)
Protected resource metadata → {apiOrigin}/.well-known/oauth-protected-resource  (via plugin)
MCP JSON-RPC transport      → POST {apiOrigin}/mcp  (@modelcontextprotocol/server v2, stateless)
Authorized tool reads       → same API origin; grant checks in @flowmark/api (later tasks)
```

The dashboard **same-origin proxy** (`apps/dashboard/features/platform/api-proxy.ts`)
may forward only the narrow OAuth/metadata paths approved in TASK-003; it must
**not** widen external redirect allowlists for ordinary login.

### Runtime placement

| Layer                            | Owner                           | Notes                                                                       |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Auth plugins + OAuth persistence | `@flowmark/auth`                | Compose `jwt()` + `mcp()` + `cimd()` in `createFlowmarkAuth` after approval |
| MCP HTTP adapter                 | `apps/server`                   | `requireMcpAuth` + official SDK handler; no stdio bridge in v1              |
| Grant/project policy             | `@flowmark/api`                 | Verified JWT claims → grant family (TASK-004+)                              |
| Tool implementations             | `apps/server` + `@flowmark/api` | Six read tools (TASK-005+)                                                  |

Licenses: MIT for Better Auth and `@modelcontextprotocol/server` (verify SPDX at install time).

## Compatibility probe (not executed in-repo)

An isolated probe **after approval** should:

1. Create a throwaway branch/worktree.
2. Apply the tranche above plus the required Drizzle bump.
3. Run Better Auth schema generation/migration diff only (no Neon apply).
4. Mount a stub `POST /mcp` handler returning `401` with correct `WWW-Authenticate` challenge.
5. Run `pnpm check` and auth package tests.

No probe was run for this ADR; absence of probe results is intentional pending
install approval.

## Verification deferred to Agent TASK-008

Real **Codex, Cursor, Claude Code, and custom MCP client** connection lifecycles
are **not** claimed passed here. TASK-008 owns external client/version evidence.

## Consequences

- Downstream OAuth/MCP tasks must treat this ADR as the **only** dependency source;
  do not pin different versions locally.
- **`pnpm add` for MCP packages requires explicit maintainer approval** separate
  from merging this decision record.
- TASK-001.2 freezes issuer paths, scopes, tool names, and client registration
  on top of this tranche.
- Enabling agent access in Production remains a feature flag / rollout gate, not
  implied by merging this ADR.

## References

- Machine-readable summary: `packages/auth/src/agent-access/mcp-dependency-proposal.ts`
- Perimeter: [Authentication boundaries](../auth-perimeter.md)
- Connect Your Agent spec (maintainer-local planning)
