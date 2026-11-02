# Authentication request boundaries

Better Auth owns email/password validation, verification policy and session
creation. Flowmark does not replace its sign-in endpoint. The local fixture is
`local@flowmark.test`; [development setup](./development.md) describes the explicit
upgrade from the old `local@dev` address. Hosted users and the local fixture use
the same provider login implementation.

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
- tRPC reads resolve project-scoped session or programmatic read authority.
  Account and project management require session authority; ingestion keys do
  not grant account-management rights. Existing isolation tests cover these
  separate boundaries, including expired, forged, signed-out and revoked
  sessions.

Authentication responses through the proxy and registration alias use
`Cache-Control: no-store`. Provider diagnostics retain severity with a fixed
label and exclude raw messages/arguments, which can contain callback URLs,
attacker-controlled headers, database errors or tokens.

## Limits and remaining work

This closes the registration HTTP-path bypass. It does **not** establish durable
cross-instance abuse protection. The installed Better Auth 1.7.13 defaults to
production-only rate limiting backed by process memory. The proxy does not yet
carry a reviewed trusted client identity from dashboard to API, so the provider
may use a shared per-path fallback bucket. Do not describe that as a per-person
limit or solve it by trusting arbitrary forwarded headers.

Before relying on hosted auth limits, review and implement:

1. A trusted identity policy for direct API traffic and the dashboard → API hop,
   with explicit behavior for missing identity and shared networks.
2. Persistent bounded counters using existing PostgreSQL, verifying the installed
   provider/Drizzle adapter's atomic consume behavior across separate instances.
   Include schema, SQL and Drizzle history together if adopting provider storage.
3. Bounded login, both signup paths, recovery and resend policies, safe storage
   failure behavior, counter expiry and operator recovery without permanent
   account lockout. Account/project/key creation also needs bounded policy.
4. Approved Staging verification through the actual proxy and direct API,
   including cookie behavior, header trust and retry feedback. Local tests do
   not prove those deployment properties.

Verification and password-recovery email remain disabled until their delivery,
policy and existing-account rollout are ready. Removing the sign-in override
does not itself enable verification or change existing account ownership.

## Evidence

`apps/server/test/http/auth-perimeter.test.ts` uses real Better Auth and a
disposable loopback PostgreSQL database. It covers verification-policy denial,
production-shaped demo misconfiguration, malicious origins/callbacks, the shared
in-process signup bucket, expired/revoked-session denial and the guarded fixture
upgrade. The shared-bucket concurrency test proves one process only.

`register-http.test.ts` checks protocol/error mapping and secret exclusion;
`apps/dashboard/test/proxy-api.test.ts` covers Fetch Metadata, retry headers and
claimed-IP exclusion. `authenticated-ingestion.test.ts` retains the full
signup → project/key → SDK ingest → session read and project-isolation coverage.

Provider references: [rate limiting](https://better-auth.com/docs/concepts/rate-limit),
[email/password](https://better-auth.com/docs/authentication/email-password).
Installed source is authoritative for the pinned behavior; newer documentation
must not be assumed to match a different provider version.
