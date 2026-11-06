# Authentication request boundaries

Better Auth owns email/password validation, verification policy and session
creation. Flowmark does not replace its sign-in endpoint. The provider factory,
signed proxy identity, and authentication-specific limit policy live in the
private `@flowmark/auth` package. Schema and the atomic limiter SQL remain in
`@flowmark/db`. The local fixture is `local@flowmark.test`. Hosted users and
the local fixture use the same provider login implementation.

## Request paths

- `/api/auth/*` calls the provider HTTP handler. Origin and CSRF checks stay
  enabled explicitly, including in tests. Provider callback validation remains
  authoritative.
- `/api/register` validates a bounded JSON body, normalizes its allowed fields
  and delegates to that same handler at `/api/auth/sign-up/email`. Original
  origin, cookies and Fetch Metadata are retained. Query parameters are not
  passed through. This alias no longer calls `auth.api.signUpEmail`, which
  bypasses the provider's HTTP rate limiter.
- Registration retains `{ "ok": true }` on success. It does not expose provider
  tokens, user details or session cookies. The dashboard signs in separately.
  Rejections preserve HTTP status with generic feedback; an unavailable provider
  returns an error, never successful registration.
- The dashboard proxy forwards origin, referer, cookies and `Sec-Fetch-Site`.
  It preserves provider `X-Retry-After` and standard `Retry-After` headers on
  responses. It does not forward browser-supplied client-IP headers as trusted
  identity.
- Agent OAuth and MCP discovery stay off unless `createFlowmarkAuth` is
  called with `agentAccess`. The disabled factory keeps the existing email,
  session, origin and CSRF plugins only. Enabled discovery documents advertise issuer-root
  `/.well-known/oauth-authorization-server`,
  `/.well-known/openid-configuration`, `/oauth2/*` and `/jwks`. The dashboard
  forwards only those issuer paths to the API auth handler under `/api/auth`.
  Ordinary `/api/auth/*` redirects stay on the dashboard origin. An
  `/oauth2/*` response may redirect to the request's own loopback or HTTPS
  `redirect_uri`, and nowhere else. The MCP resource identifier is
  `{apiOrigin}/mcp`. That resource accepts the issued scopes, including
  `offline_access`, so the provider can keep and rotate a refresh token.
  The audience stays the MCP resource.
  Dynamic client registration is off, and remote client-metadata documents are
  refused. Authorization-code exchange, PKCE and refresh rotation stay in the
  provider. The server-owned grant family is that provider authorization-code
  id, with the subject, client, configured issuer and MCP resource. It carries
  no project. A provider token is not a project grant: project reads still
  require a later explicit grant intersected with current membership. Enabling
  the provider leaves signup, sign-in, password recovery, origin checks and
  account limits on the same handlers. `get-session` accepts the dashboard
  session cookie and does not treat the provider access token as that session.
  `POST /mcp` is not served by the auth handler. A mismatched issuer and auth
  base URL fails before the provider is composed. With `agentAccess` omitted,
  discovery and the token endpoint stay unavailable.
- tRPC reads resolve project-scoped session or programmatic read authority.
  Account and project management require session authority; ingestion keys do
  not grant account-management rights. Existing isolation tests cover these
  separate boundaries, including expired, forged, signed-out and revoked
  sessions.

### Delegated workflow reads (tRPC)

When **all** of the following are present on a read request, the API resolves
authority through the **delegated reader** path (`ProjectReader` tag `DelegatedUser`):

| Header                                   | Role                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `x-flowmark-project-id`                  | UUID of the project to read (required for delegated reads).                   |
| `x-flowmark-grant-client-id`             | OAuth `client_id` for the connection.                                         |
| `x-flowmark-grant-authorization-code-id` | Grant family id (matches `oauth_refresh_token.authorization_code_id`).        |
| Session cookie                           | Same requirement as other session-backed reads; headers alone are not enough. |

**Semantics.** The server authorizes read only if the project id appears in
`agent_access_grant_projects` for that grant family **and** the subject user is
still a **project member** **and** there is an **active** (not revoked, unexpired)
refresh token row for that user, client and authorization-code id. Sending only
one of the two grant headers fails closed (read unauthorized).

**Grant rows and revocation.** Session consent (`agentAccess.submitConsent`) writes
`agent_access_grant_projects` for the active grant family. Revoking a connection
(`agentAccess.revokeConnection`) or completing **password reset** revokes OAuth
refresh/access rows in storage, deletes grant and last-auth rows for that family,
and marks consent intents `revoked` where applicable — so a **second API instance**
still denies delegated reads because authorization re-reads stored state. Submitting
consent for a **new** grant family supersedes a prior family (old tokens revoked;
intents `superseded`); reconnection cannot widen or resurrect revoked credentials.
Ordinary dashboard reads (session + optional `x-flowmark-project-id` without grant
headers) are unchanged.

Authentication responses through the proxy and registration alias use
`Cache-Control: no-store`. Provider diagnostics retain severity with a fixed
label and exclude raw messages/arguments, which can contain callback URLs,
attacker-controlled headers, database errors or tokens.

## Durable limits

Better Auth's native HTTP limiter uses a supported `customStorage.consume`
adapter backed by PostgreSQL. Account hooks use the same adapter for both HTTP
and server `auth.api` calls. Provider login/session/token implementation stays
unchanged. The stock database backend was inspected: it supports conditional
atomic increments, but its raw IP keys and rolling last-request lifetime do not
provide the pseudonymous, fixed-expiry, shared account budgets used here.

Limits use the database clock and fixed windows, with atomic insert/update.
Concurrent instances share the same decision; denied attempts never increase the
counter or extend its expiry. Every consume first spends one of 2,000 service
admission units per minute. This bounds fresh-counter allocation even when a
caller rotates addresses. A request may spend several units across source,
service and account checks. Counters fail closed: unavailable storage returns
503, never an in-memory or allow-on-error fallback. HTTP 429 responses carry both
`Retry-After` and `X-Retry-After`; registration and the dashboard preserve them.

The current reference policy counts attempts, including valid, invalid and
unknown accounts:

- Login: 10 per normalized email per minute, plus 60 per trusted network source
  per minute when available.
- Signup: 5 per address per 15 minutes, 20 per trusted source per minute and 25
  service-wide per 15 minutes. Both signup paths share these budgets. The service
  ceiling deliberately bounds account/storage creation; it is not a user limit.
- Reset requests and verification resend: 3 per address per 15 minutes, 30 per
  trusted source per minute and 100 per operation service-wide per 15 minutes.
- Other auth paths: 300 per trusted source per minute; password/email changes
  and reset completion use 30 per trusted source per minute. Without a trusted
  source, non-email paths retain a high 2,000-per-path service safety ceiling.
- Authenticated management: 10 project creation attempts per user per 15 minutes;
  30 combined write/browser-key creations or rotations per user per 15 minutes.
  Authorization precedes key budgets. Revocation remains available after a
  creation budget is exhausted. tRPC returns `TOO_MANY_REQUESTS` with bounded
  retry guidance; a rejected operation creates no hidden project/key.

A person sharing an IP can encounter a network ceiling, and strangers can
consume a target address's temporary account budget. Fixed expiry prevents an
attacker from extending a denied window indefinitely; there is no permanent
lockout or manual SQL reset needed for ordinary recovery. Persistent abuse still
requires operator investigation. Service ceilings trade temporary availability
for bounded resource use; review workload before changing the source constants.

## Trusted client identity

The API removes any incoming `x-flowmark-auth-client-ip` before provider IP
resolution. It never trusts an ordinary browser-supplied `X-Forwarded-For`.

On Vercel (`VERCEL=1`), direct requests use the platform's single
`x-vercel-forwarded-for` address. See [Vercel request headers](https://vercel.com/docs/headers/request-headers).
For self-hosting, the optional `FLOWMARK_AUTH_TRUSTED_IP_HEADER` accepts
`x-real-ip` or `cf-connecting-ip` only after the operator restricts the origin to a
proxy that overwrites that header. A header name alone does not establish trust;
leave this unset on an unprotected origin. Invalid/multiple addresses supply no
source identity.

The dashboard signs its platform-resolved IP with a separate, server-only
`FLOWMARK_AUTH_PROXY_SECRET` (at least 32 characters), shared only with the API in
the same environment. Browser-supplied assertions/internal headers are dropped.
The assertion binds IP, timestamp, method and canonical auth path; registration
and provider signup map to the same path. The API checks its HMAC in constant
time, accepts at most 30 seconds of age / 5 seconds of future clock skew, and
rejects invalid assertions with 403. Missing verification configuration gives 503. The assertion grants no session or resource authority; replay within its
short lifetime always spends the same source bucket and cannot evade a limit.
It intentionally does not authenticate the request body.

An authenticated assertion can explicitly report that no reliable IP exists;
then the API does not substitute the dashboard's egress IP. Email account and
service budgets continue to work independently. Without a configured assertion,
a Vercel API sees the immediate network source: dashboard users can share that
hop's network ceiling. Configure and verify the signed hop before claiming
hosted end-user IP isolation. No IP or account limit is an identity/ownership proof.

## Counter privacy, expiry and recovery

Only 64-character keyed HMAC identifiers, counts and expiry timestamps are
stored for public auth budgets; no raw email, IP, cookie or password. Management
uses a namespaced digest of its immutable random user ID and one of two fixed
operation kinds. Rows contain no token or usable credential and have no user FK.

Windows are at most 15 minutes. Each atomic consume prunes up to 100 other
expired rows through the expiry index with `SKIP LOCKED`; the active key resets
in place on expiry. Physical removal is traffic-driven: after traffic stops,
expired pseudonymous rows can remain until the next consume. Do not promise a
wall-clock erasure deadline or claim a background cleanup is running. The
service admission guard bounds fresh row allocation during traffic. Counters
must be included in the future lifecycle/backup inventory as short-lived
security state; do not export them as account credentials or restore old locks
as user identity.

Operator recovery: distinguish 429 from storage/configuration 503, wait for the
fixed window, and repair the database or proxy binding for the exact environment.
Do not disable origin checks, switch to memory storage, clear customer telemetry
or delete counters to make a request succeed. Auth signing-secret rotation also
changes counter namespaces and is a separately reviewed security operation.

## Rollout

Provision or change hosted auth/proxy bindings through the
[Pulumi writer policy](./infrastructure.md#pulumi-is-the-infrastructure-writer),
with encrypted inputs and reviewed scopes before apply. Do not create a secret
through the provider UI/CLI/connector and reconcile it into Pulumi afterward.

Migration `0017_auth_rate_limits` adds one indexed table and changes no existing
rows. Apply it before dependent API code through [database rollout](./migrations.md).
New proxy metadata uses the existing server-only `FLOWMARK_*` environment path;
never use `NEXT_PUBLIC_*`, a browser cookie, or the Better Auth signing secret for
it. Prepare separate proxy secrets for Preview, Staging and Production. The
optional self-hosted trusted-header setting does not belong on Vercel.

Implementation tests are separate from hosted activation. Before accepting the
Staging proxy contract, approve the exact environment/revision, provision the
matching API/dashboard proxy secret through the existing guarded environment
workflow, migrate/deploy in order, then verify real platform headers, two-user
isolation, cookies, direct API limits, alias limits and retry feedback. Preview
is currently paused; do not enable it as part of this change. Production remains
a separate release gate.

Password recovery is implemented separately through the server email adapter,
with one-time links and prior-session revocation. Normal signup/sign-in does not
require email verification. The historical hosted acceptance below predates this
consumer; deploying recovery requires review of its environment/revision and
separate inbox acceptance.

## Evidence

`apps/server/test/http/auth-perimeter.test.ts` uses real Better Auth and a
disposable loopback PostgreSQL database. It covers verification-policy denial,
production-shaped demo misconfiguration, malicious origins/callbacks, the shared
in-process signup bucket, expired/revoked-session denial and local fixture
provisioning. Durable limit tests use independent database clients and auth
instances. `packages/auth/test/server-boundary.test.ts` checks that
`@flowmark/auth/client-identity` stays free of the database and provider, and
that package exports stay server-only.

`register-http.test.ts` checks protocol/error mapping and secret exclusion;
`apps/dashboard/test/proxy-api.test.ts` covers Fetch Metadata, retry headers and
claimed-IP exclusion. `authenticated-ingestion.test.ts` retains the full
signup → project/key → SDK ingest → session read and project-isolation coverage.

`durable-auth-limits.test.ts` covers exact concurrency bounds, expired-window
renewal, independent accounts without an IP, server-call signup limits,
recovery/resend limits, bounded pruning, admission denial and storage failure.
`auth-client-identity.test.ts` covers trusted-source selection, forged headers,
missing identity, signed alias canonicalization, tampering, expiry, future clocks
and cross-secret/method/path denial. The management integration adds concurrent
project/key creation and revocation after exhaustion.

Provider references: [rate limiting](https://better-auth.com/docs/concepts/rate-limit),
[email/password](https://better-auth.com/docs/authentication/email-password).
Installed source is authoritative for the pinned behavior; newer documentation
must not be assumed to match a different provider version.

### Staging acceptance — 2 November 2026

The ordered Staging rollout of `cf0b563` applied migration history through
`0017_auth_rate_limits` before deploying the API and remaining apps. The matching
API/dashboard proxy secret is now managed by Pulumi's nonprod stack; see the
[environment contract](../infrastructure/environments.md#staging-auth-proxy-binding).
Production acceptance is recorded below; automatic feature Preview remains paused.

Automated hosted acceptance passed 42 checks using two explicitly authorized,
labelled synthetic accounts and projects. It covered registration through the
dashboard alias, proxy and direct sign-in, Secure/HttpOnly cookies, own-project
reads after ingestion, cross-owner read/key-list denial, malformed proxy-assertion
denial, and revoked-key/session read and mutation denial. Direct and proxied
sessions recorded the same nonempty platform source while a forged IP-header
claim was ignored. No IP, password, cookie or key payload was logged. Test keys
and sessions were revoked; the labelled accounts, projects and two synthetic
runs remain until a separately approved deletion path exists.

This is live request-path and authorization evidence, not a hosted exhaustion or
load test. Exact quota/concurrency bounds and Retry-After behavior remain covered
by the disposable PostgreSQL and adapter tests above. Email verification and
recovery delivery remain disabled and outside this acceptance.

### Production acceptance — 2 November 2026

The separately approved [Production rollout](https://github.com/Mumma6/flowmark/actions/runs/41442674430)
passed at exact main merge `335d3f6` after release PR #73. It verified/applied
migration history through `0017_auth_rate_limits` before deploying the API, then
the remaining apps. All four canonical domains resolve to READY Production
deployments at that SHA. Pulumi created exactly two Production-only sensitive
proxy bindings while leaving the existing 27 resources unchanged; existing
Better Auth/database credentials and nonprod bindings were preserved.

All 42 automated hosted checks passed with two explicitly authorized, labelled
synthetic accounts/projects: registration, proxy/direct sign-in, Secure/HttpOnly
cookies, source agreement despite a forged IP-header claim, own-project
persistence/read, reciprocal project/key-list denial, and key/session revocation.
All created test keys and sessions were revoked. Bounded cleanup also expired
the provider-generated signup sessions; a scoped database check confirmed zero
active sessions for those two synthetic users. The two labelled accounts,
projects and synthetic runs remain until a safe approved deletion path exists;
no secrets or raw source IPs were logged. No hosted quota exhaustion, external
mail, SDK publication or auth package extraction was part of this rollout.
The separately approved [v0.6.3 release](https://github.com/Mumma6/flowmark/releases/tag/v0.6.3)
was published at the same verified SHA.
