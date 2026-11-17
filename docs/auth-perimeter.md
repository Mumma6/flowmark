# Authentication request boundaries

Better Auth owns email/password validation, verification policy and session
creation. Flowmark does not replace its sign-in endpoint. The provider factory,
signed proxy identity, and authentication-specific limit policy live in the
private `@flowmark/auth` package. Schema and the atomic limiter SQL remain in
`@flowmark/db`. The local fixture is `local@flowmark.test`. Hosted users and
the local fixture use the same provider login implementation.

## Optional verification and account recovery

Address verification is optional. Signup does not send mail, sign-in does not
require `emailVerified`, and neither path marks an existing account verified.
There is no migration or login job that sets `emailVerified=true`. A local
fixture is not copied into a hosted environment as a verified user.

Recovery proves access to the account mailbox with one provider link. It does
not require or set the verified flag. A reset link is single-use, expires after
30 minutes, revokes existing sessions and does not accept the previous password.
Direct reset and email-change calls without that proof are rejected. Duplicate
signup, including `POST /api/register`, leaves the original account and password
in place and does not issue a session. A rejected verification send leaves the
account unverified and usable; the same signed-in account can request the link
again.

The dashboard pages are `/forgot-password` and `/reset-password`. Verification
returns to `/settings?section=account&emailVerification=complete` on the
configured dashboard origin. Reset and verification links are provider URLs on
that same origin. Pages use `no-store`/`no-referrer` where they carry a token,
and the reset form removes the token from the address bar after reading it.
Unknown addresses get the same reset-request response as known addresses.
Creating a second account is not the recovery path.

## Request paths

- `POST /v1/read/run` accepts only a live stored project read key and an explicit
  matching project/run selection. Write/browser/demo keys, cookie sessions,
  delegated identity headers and MCP audience tokens are rejected. Service,
  project and authenticated-key budgets use a distinct public-read namespace.
  Session-only `project.createReadKey` checks project membership and the existing
  key-creation quota; existing project-scoped revocation applies. See the
  [public read guide](./sdk/public-run-read.md).

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
  The handler serves the two discovery documents on that mount. The provider's
  automatic metadata route is the issuer root, so `/api/auth/.well-known/*`
  would otherwise miss it.
  Ordinary `/api/auth/*` redirects stay on the dashboard origin. An
  `/oauth2/*` response may redirect to the request's own loopback or HTTPS
  `redirect_uri`, and nowhere else. A browser GET or HEAD whose provider body
  is `{ "redirect": true, "url" }` becomes that same checked HTTP redirect.
  The JSON document is not shown. The MCP resource identifier is
  `{apiOrigin}/mcp`. That resource accepts the issued scopes, including
  `offline_access`, so the provider can keep and rotate a refresh token.
  The audience stays the MCP resource.
  Dynamic client registration is off, and remote client-metadata documents are
  refused. Authorization-code exchange, PKCE and refresh rotation stay in the
  provider. The server-owned grant family is that provider authorization-code
  id, with the subject, client, configured issuer and MCP resource. It carries
  no project. Access tokens carry that exact id in the provider-signed
  `flowmark_grant_family` claim; refresh preserves it. MCP checks the claimed
  family against active PostgreSQL state and never substitutes another active
  family for the same user/client. Tokens without the claim require fresh
  authorization. A provider token is not a project grant: project reads still
  require a later explicit grant intersected with current membership. Enabling
  the provider leaves signup, sign-in, password recovery, origin checks and
  account limits on the same handlers. `get-session` accepts the dashboard
  session cookie and does not treat the provider access token as that session.
  Agent access is part of the server. `POST /mcp` is served whenever the issuer
  and API origins resolve (`FLOWMARK_API_URL`, or the reference Production or
  Staging API origin for `BETTER_AUTH_URL`, plus `FLOWMARK_DASHBOARD_ORIGIN`).
  Unresolved origins return 503 and no evidence. `GET /mcp` is `405`.
  MCP checks the request URL and Host against the configured API hostname before
  reading a body or validating a token. A present Origin must exactly equal the
  configured API or issuer origin, including scheme and port; native clients
  may omit it. Forwarded headers are not authority for either check. Invalid
  authority returns a fixed `403` response with `no-store`.
  An unsupported `initialize` protocol revision is negotiated to a supported
  revision and is not stored as the session version. Admission failure uses the
  fixed label `Read admission is unavailable.` Requests and tool results are
  capped at 64 KiB. A read token is not an ingestion key or a dashboard
  session, so it cannot ingest, manage accounts, or write declarations. Protected-resource
  metadata is on the API host (`/.well-known/oauth-protected-resource` and the
  path-aware `/mcp` suffix per RFC 9728). A mismatched issuer and auth base URL
  fails before the provider is composed. With `agentAccess` omitted, discovery
  and the token endpoint stay unavailable.
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

Explicit disconnect also removes the matching Flowmark resource from the
provider's cached consent in the same transaction. Otherwise a client reconnect
could skip project selection and obtain a token with no usable project grant.
Unrelated resource permissions and revoked consent-intent history are retained.
Account-wide delegated revocation applies the same invalidation; ordinary
accepted-consent supersession preserves the new permission. The
[Codex CLI evidence record](./agent-clients/codex-cli.md) covers the observed
client behavior and verification limits.

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

The [composed agent security audit](./agent-access-security-audit.md) records
the OAuth → live grant → MCP → scoped persistence checks, bounded reads and
their remaining client/hosted verification limits.

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

## Browser agent consent

The dedicated `/connect/agent/sign-in` route preserves the provider-signed query
through login to `/connect/agent/consent`. The form displays the current account,
stored client name/id, requested persistent read access and explicit project
choices, initially empty. Client text is rendered as text; no remote logo is loaded.

The same-origin `/api/agent-consent` proxy forwards to session-only
`GET/POST /v1/agent-consent`. The server verifies the provider query signature,
expiry, registered redirect, known scopes and exact resource before displaying
metadata. A secret HMAC binds submission to the query and current user/session;
account changes require reloading. Origin checks remain enforced on submission.

The native provider owns consent and code issuance. Before returning the callback,
Flowmark locks the actual unexpired provider authorization-code record and binds
only submitted current memberships to that code's hash in
`agent_access_grant_projects`. Token exchange retains the same family identifier.
The canonical provider consent serializes authorization versions. A replacement
revokes the prior family, invalidates its unexchanged code and updates the existing
consent intent before returning the new callback. Old tokens cannot inherit the
replacement projects. No plaintext tokens, new cookie authority or new schema
are introduced. Denial
returns the provider's denial callback; cancel leaves the request without consent.
Responses use `no-store` and `no-referrer`. Signing out does not revoke prior grants.

OAuth authorize/token admission has separate durable counters from account login
and MCP reads. Revoke is exempt from those creation/read budgets. See
[ADR 0008](./decisions/0008-connect-agent-protocol-contract.md) for limits.

## Connection feedback in Studio

The stored `lastAuthenticatedAt` belongs to a grant family, not to a project or
successful tool result. `get_connection` and a request that later fails can update
it. Studio labels this **Connection authenticated** and does not infer successful
project evidence retrieval from it or from Studio's session-based run reads.

Revocation feedback cancels older connection-list requests and reads fresh server
state. A lost mutation response may still be confirmed if the grant is absent.
If confirmation fails, the status remains unknown and **Refresh connections**
only repeats the read. It never resends the mutation. Connection-detail loading,
failures and missing authority have separate states; unavailable cached rows
are not offered as current management targets.

## Invite-only Production registration

Production (`VERCEL_ENV=production`) permits account creation only with an
unexpired private invitation link and its matching email address. The normal
`/sign-up` page redirects to sign-in without a link; sign-in has no public signup
navigation. Both `/api/register` and Better Auth's signup API reach the provider's
`user.create.before` database hook, which checks the private PostgreSQL allowlist.
The check compares normalized, case-insensitive mailboxes and a SHA-256 token
hash. Raw tokens are sent only in the invitation email and registration request,
never stored in PostgreSQL or logged by the CLI. No invitation lookup endpoint is
exposed. The invitation is removed after account creation. Links expire after 24
hours.

From a trusted operator shell, run:

```sh
pnpm invite user@example.com
```

With no explicit invitation environment, the command reads the existing Pulumi
`production` stack through the signed-in Pulumi CLI. It reuses the managed Neon
branch/compute/role/database, domain-restricted sending key, and API email
bindings. Values remain in process memory: no hosted settings, app env files or
parallel secret catalog are created or updated. The command prints its target
before proceeding. Pulumi must already be installed and authenticated.

Check the configuration and invitation table without writing or sending email:

```sh
pnpm invite user@example.com --check
```

A complete explicit environment remains supported for Staging, Preview or local
operation: supply `DATABASE_URL`, `BETTER_AUTH_URL`, `RESEND_API_KEY`,
`FLOWMARK_EMAIL_FROM`, `FLOWMARK_EMAIL_REPLY_TO`, and
`FLOWMARK_EMAIL_ENVIRONMENT`. Hosted targets also need the matching `NEON_BRANCH`;
leave `DATABASE_MIGRATION_URL` unset. Partial explicit settings fail with the
missing variable names and never fall back to Production. Local targets still
pass the checkout-owned Compose guard. The command never migrates or seeds.

Duplicate active invitations and existing accounts send no email. Running the
command after expiry issues a new link and invalidates the old one. A reported
email-submission failure removes that reservation for an explicit retry; an
ambiguous network failure may already have delivered an email, whose link is then
invalid. No automatic retries occur. Keep operator secrets out of shell history,
source control, and chat.

Existing sign-in, optional email verification, recovery, Preview/Staging signup,
and the anonymous waitlist remain unchanged. Invitations never mark an address
verified or grant project access. Apply migration `0036` before app rollout using
the approved ordered migration/deployment workflow. Verify shared Preview before
merge; Production migration, deployment, and sending invitations require the
maintainer's approval.
