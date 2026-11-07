# ADR 0007: Connect Your Agent — MCP and OAuth dependency proposal

- Status: accepted
- Date: 2026-11-05
- Task: Agent TASK-001.1 (dependency compatibility decision)
- Evidence: npm registry metadata plus read-only `npm pack` inspection of
  `@better-auth/mcp@1.7.17`, `@better-auth/oauth-provider@1.7.17`, and
  `@better-auth/cimd@1.7.17` (not installed in the monorepo tree)

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
- npm registry metadata for the proposed pins below

Installed-tree review: `better-auth@1.7.13` in the lockfile does **not** export
an MCP plugin; MCP moved to **`@better-auth/mcp`** starting in the 1.7 line.

## Current Flowmark baseline (reviewed in-repo)

### Auth factory and plugins today

`createFlowmarkAuth` wires a Drizzle adapter with **four** auth tables only
(`user`, `session`, `account`, `verification`), email/password, custom rate-limit
storage, and the **`accountRateLimits`** plugin. There is **no** `jwt()`, `mcp()`,
or `cimd()` plugin yet.

The HTTP boundary wraps `auth.handler` with client-identity normalization, masks
5xx responses, and preserves 429 semantics — OAuth/MCP routes must remain
behind this wrapper when mounted on the API auth route.

### Database schema today

`packages/db/src/schema/auth.ts` defines `user`, `session`, `account`,
`verification`, and Flowmark-owned `auth_rate_limits`. **No** OAuth provider
tables exist yet.

### Origins and perimeter

Hosted configuration separates **dashboard origin** (`FLOWMARK_DASHBOARD_ORIGIN`)
from **Better Auth base URL** (`BETTER_AUTH_URL`). In local dev they usually
match; in hosted environments both are dashboard origins per
`infrastructure/environments.md`.

The API server resolves both via `serverOrigins()` and passes `baseURL` into
`createFlowmarkAuth`. Browser clients use **`/api/auth/*` on the dashboard**;
the dashboard proxies those paths to the API and rewrites **`Location`** only when
the redirect stays on the **same dashboard origin** (no external OAuth redirects
today).

MCP agent clients will call **`POST {apiOrigin}/mcp`** on the API host, not through
the dashboard proxy. That split is intentional: session cookies stay on the
dashboard perimeter; bearer tokens stay on the API resource server.

### Implication for `@better-auth/mcp`

The MCP plugin’s `resource` option must be the **canonical HTTPS URL of the MCP
HTTP endpoint** (RFC 8707 / 9728), e.g. `{apiOrigin}/mcp`, with no query or
fragment. The authorization-server **issuer** in discovery metadata comes from
Better Auth **`baseURL`** (expected to remain the dashboard-facing auth origin).

When the auth process runs on the API app but `baseURL` names the dashboard,
`requireMcpAuth` **must** override `issuer` (and likely `jwksUrl`) to match
issued tokens — defaults that assume issuer equals the request host are **not**
sufficient for Flowmark’s two-origin layout. TASK-003 owns proxy/well-known
routing; this ADR only records the constraint.

## Decision (proposal — packages not installed by this ADR)

Adopt a **single reviewed dependency tranche** before any OAuth/MCP implementation.
Do **not** install or upgrade until a maintainer explicitly approves this tranche
and any coupled persistence work.

| Package                        | Proposed pin | Role                                                                    |
| ------------------------------ | ------------ | ----------------------------------------------------------------------- |
| `better-auth`                  | **1.7.17**   | Core auth; upgrade from 1.7.13                                          |
| `@better-auth/drizzle-adapter` | **1.7.17**   | Must match core                                                         |
| `@better-auth/mcp`             | **1.7.17**   | OAuth 2.1 AS + MCP resource binding (`mcp()` plugin)                    |
| `@better-auth/cimd`            | **1.7.17**   | Client ID Metadata Documents for MCP 2026-07-28 profile                 |
| `@modelcontextprotocol/server` | **2.3.1**    | Stateless MCP HTTP handler (`legacy: "reject"`, profile **2026-07-28**) |
| `zod`                          | **^4.2.0**   | Peer of `@modelcontextprotocol/server` (MCP shell only, not all apps)   |
| `better-call`                  | **1.4.5**    | Exact peer required by `@better-auth/mcp` / `@better-auth/cimd`         |

**Transitive (verify at install, do not pin separately unless drift breaks CI):**

- `@better-auth/oauth-provider@^1.7.17` (pulled by `@better-auth/mcp`)
- `jose@^6.1.3` (token crypto for MCP resource verification)

**MCP SDK pin rationale:** `@better-auth/mcp@1.7.17` lists
`@modelcontextprotocol/server@2.3.1` in its own **devDependencies** and documents
v2 with `legacy: "reject"`. **`2.3.1`** is the conservative compatibility anchor;
**2.4.0** is newer on npm with the same `zod ^4.2.0` constraint — the post-approval
probe should confirm 2.4.x if maintainers prefer latest patch.

**Rejected without a new ADR:**

- **Better Auth 1.8 beta** — pre-release; not for production agent access.
- A **custom JWT/OAuth issuer** outside Better Auth.
- A **second OAuth provider plugin** alongside `mcp()` — upstream explicitly forbids
  registering `oauthProvider()` separately when using `mcp()`.
- **Dynamic Client Registration** by default — MCP profile prefers CIMD with
  `metadataProfile: "mcp-2026-07-28"`; DCR stays off until TASK-001.2 documents a client need.
- Treating **upstream examples** or **Vercel MCP handler blog posts** as compatibility proof.

### Required plugin composition (after approval)

Per `@better-auth/mcp` types and README:

```ts
plugins: [
  jwt(), // JWKS for access tokens; disable colliding JWT routes per upstream docs
  mcp({
    loginPage: "...",
    consentPage: "...",
    resource: "{apiOrigin}/mcp",
  }),
  cimd({
    fetchClientMetadataResource, // application-owned transport
    metadataProfile: "mcp-2026-07-28",
  }),
]
```

`mcp()` **is** `oauthProvider()` preconfigured: it binds tokens to `resource`,
serves RFC 9728 protected-resource metadata at
**`/.well-known/oauth-protected-resource`** on the auth server, and defaults
**`refreshTokenReuseInterval` to 30 seconds** for MCP clients (retried refresh after rotation).

Transport: **`requireMcpAuth(auth, handler)`** on **`POST /mcp`** plus
`@modelcontextprotocol/server` v2 handler with **`legacy: "reject"`** — no stdio
bridge, no Redis MCP session store for the baseline profile.

### Auth upgrade and persistence coupling

`@better-auth/mcp@1.7.17` peers require `better-auth ^1.7.17`, `better-call 1.4.5`,
and `@better-auth/core ^1.7.17`.

`@better-auth/drizzle-adapter@1.7.17` peers require **`drizzle-orm ^0.45.2`**
(Flowmark is on **0.44.x** today). The auth bump and Drizzle bump must land in
one reviewed change with `@flowmark/db` migration/generator verification — not
as a silent transitive upgrade during MCP install.

**OAuth provider tables** (from `@better-auth/oauth-provider@1.7.17` bundle defaults;
exact columns come from Better Auth schema generation at install time):

| Model / table          | Purpose (high level)                           |
| ---------------------- | ---------------------------------------------- |
| `oauthClient`          | Registered OAuth clients (incl. CIMD linkage)  |
| `oauthResource`        | Resource-server metadata rows                  |
| `oauthClientResource`  | Client ↔ resource join                         |
| `oauthAccessToken`     | Issued access tokens (incl. refresh semantics) |
| `oauthConsent`         | User consent records                           |
| `oauthClientAssertion` | Client assertion / JWT bearer auth             |

Flowmark must extend the Drizzle adapter **`schema`** map in `createFlowmarkAuth`
and add matching Drizzle tables in `@flowmark/db` — not reuse legacy MCP tables
from pre-1.7 experiments.

**DPoP replay protection:** `requireMcpAuth` defaults to a DB-backed replay store
via the auth adapter; expect additional persistence or adapter hooks when DPoP is
enabled — confirm in the install probe.

### OAuth surface assumed (freeze details in TASK-001.2)

From `@better-auth/oauth-provider@1.7.17` route registration (prefix **`/oauth2`**):

- `GET/POST …/oauth2/authorize`, `POST …/oauth2/token`, `POST …/oauth2/introspect`,
  `POST …/oauth2/revoke`, optional `POST …/oauth2/register`
- OIDC: `…/oauth2/userinfo`, end-session endpoints, `/.well-known/openid-configuration`
- Authorization-server metadata: `/.well-known/oauth-authorization-server` (or exportable
  handlers when `basePath` prevents root discovery — Flowmark must choose explicitly in TASK-003)

Legacy **`/mcp/*` OAuth paths** from pre-split Better Auth are **not** assumed.

Scopes, grant types, and **`flowmark:read`** naming are **not** frozen here.

### Route and origin sketch (compatibility target)

```text
Browser login + consent     → dashboard origin (existing cookies, CSRF, proxy rules)
OAuth AS metadata + flows   → {issuer}/oauth2/*  (Better Auth + @better-auth/mcp)
Well-known (as needed)      → dashboard and/or API — TASK-003 lists exact paths
Protected resource metadata → plugin path on auth server; resource URL = {apiOrigin}/mcp
MCP JSON-RPC transport      → POST {apiOrigin}/mcp  (@modelcontextprotocol/server v2)
Authorized tool reads       → same API origin; grant checks in @flowmark/api (later tasks)
```

The dashboard **same-origin proxy** may forward only the narrow OAuth/metadata paths
approved in TASK-003. Today’s proxy **rejects external `Location` redirects** on
`/api/auth/*`; OAuth authorize flows that redirect to native loopback clients are
a **TASK-003** concern, not widened here.

### Rate limits and account budgets

New OAuth endpoints fall under the existing catch-all rule **`"/**"`** in
`createFlowmarkAuth` (300/min with trusted proxy identity header, 2000/min otherwise)
unless TASK-002 adds explicit `/oauth2/*` rules. Token and authorize endpoints may
need tighter budgets before Production agent access.

### Runtime placement

| Layer                            | Owner                             | Notes                                                                       |
| -------------------------------- | --------------------------------- | --------------------------------------------------------------------------- |
| Auth plugins + OAuth persistence | `@flowmark/auth`                  | Compose `jwt()` + `mcp()` + `cimd()` in `createFlowmarkAuth` after approval |
| MCP HTTP adapter                 | `@flowmark/mcp` + `apps/server`   | Protocol, tools, and SDK handler in `@flowmark/mcp`; server mounts routes   |
| Grant/project policy             | `@flowmark/api`                   | Verified JWT claims → grant family (TASK-004+)                              |
| Tool implementations             | `@flowmark/mcp` + `@flowmark/api` | Tool wiring in `@flowmark/mcp`; use cases in `@flowmark/api` (TASK-005+)    |

Licenses: MIT for Better Auth and `@modelcontextprotocol/server` (verify SPDX at install time).

## 1.7.13 → 1.7.17 upgrade notes (decision-time, not probed)

This ADR does **not** claim a green `pnpm check` on 1.7.17 yet. Known coupling:

- Peer alignment for `@better-auth/drizzle-adapter` and **`drizzle-orm ^0.45.2`**
- New OAuth schema migrations and adapter `schema` wiring
- Possible minor Better Auth core behavior changes between patch releases — read
  [1.7.17 release notes](https://github.com/better-auth/better-auth/releases) at install time

Email/password flows, proxy identity, and `accountRateLimits` must be re-tested
after upgrade in the compatibility probe.

## Compatibility probe (not executed in-repo)

An isolated probe **after approval** should:

1. Create a throwaway branch/worktree.
2. Apply the tranche above plus the required Drizzle bump and `better-call@1.4.5`.
3. Run Better Auth schema generation/migration diff only (no Neon apply).
4. Mount a stub `POST /mcp` handler returning `401` with correct `WWW-Authenticate` challenge.
5. Verify `issuer` / `jwksUrl` overrides for two-origin layout.
6. Run `pnpm check` and auth package tests.

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
- Issuer paths, scopes, tool names, and client registration are frozen in
  [ADR 0008](./0008-connect-agent-protocol-contract.md).
- Enabling agent access in Production remains a feature flag / rollout gate, not
  implied by merging this ADR.

## References

- Machine-readable summary: `packages/auth/src/agent-access/mcp-dependency-proposal.ts`
- Perimeter: [Authentication boundaries](../auth-perimeter.md)
- Connect Your Agent spec (maintainer-local planning)
