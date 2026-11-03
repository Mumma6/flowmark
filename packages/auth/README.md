# @flowmark/auth

Internal authentication package for Flowmark. It is private and is not
published to npm.

It owns Better Auth configuration, the auth factory, local fixture user
provisioning, signed proxy identity, and the authentication-specific limit
policy. It depends on `@flowmark/db` for the auth tables and the atomic
limiter write. `@flowmark/db` does not depend on this package.

Project membership, ingestion keys, and project/key creation quotas stay in
`@flowmark/api` and `@flowmark/db`. SQL and migrations stay in `@flowmark/db`.

| Export                           | Use                                                                 |
| -------------------------------- | ------------------------------------------------------------------- |
| `@flowmark/auth`                 | Server auth factory and secret resolution. Not for browser bundles. |
| `@flowmark/auth/client-identity` | Signed proxy identity. No database or provider imports.             |
| `@flowmark/auth/limits`          | Durable auth-limit storage adapter.                                 |
| `@flowmark/auth/seed`            | Local fixture account provisioning.                                 |

`pnpm db:seed` and `pnpm db:setup` build `@flowmark/db` and its workspace
dependencies, including core, and then run this
package's local commands. They require the checkout-owned Compose database and refuse production,
unmanaged and non-loopback databases. Setup also refuses a migration URL naming a different local host,
port, database, or role before SQL. It migrates and seeds through the runtime
URL, retaining that URL's connection settings. Hosted environment names and
migration wrappers are unchanged.

## Transactional email callbacks

`createFlowmarkAuth` accepts an optional `emailDelivery` service from the private
`@flowmark/email` package. Resolve the service at the server composition root
and inject it explicitly. With no injection, verification and password-reset
sending callbacks remain absent even when Resend settings exist in the process.
There is no implicit network client or capture fallback in the auth factory.

The provider callback adapter sends verification and reset messages using the
original Better Auth URL, recipient and a fresh opaque message ID. Both token
lifetimes are 30 minutes, matching the template expiry text. There are no
automatic submission retries. A successful password reset invokes a token-free
password-changed notice. The provider owns token validation/consumption,
password updates and session revocation; reset does not mark an address verified.

`apps/server` resolves Resend from the existing server-only email settings and
canonical `BETTER_AUTH_URL`. With no mail configuration, recovery remains
unavailable; partial/invalid configuration fails explicitly rather than falling
back to capture. Existing Staging/Production bindings are sufficient, with no
new hosted variable. Deploying this revision with those bindings activates
recovery, so review the rollout environment/revision before deployment.

The server injects a lifetime-managed background task handler backed by Next.js
`after()`. Provider mail requests acknowledge the request without waiting for
external delivery. Failed submissions retain safe server diagnostics and do not
reveal whether an address exists. A 500ms minimum response duration covers the
ordinary lookup/write timing difference; source/account/service rate limits
still apply. This is not a durable queue or a delivery guarantee.

Reset-completion notices use the same lifetime handler after the password/session
transaction commits, so notification failure does not turn completed recovery
into an HTTP failure. Without a supplied lifetime handler, the callbacks await
submission, which is useful for capture tests. Requests never log raw tokens,
recipients, provider bodies or credentials. No automatic verification send or
verification auto-sign-in is enabled; normal access remains unverified-compatible.

The dashboard provides `/forgot-password` and `/reset-password`, generic request
feedback, explicit invalid/expired/used-link recovery and a sign-in route after
success. Network/5xx ambiguity during completion offers sign-in with the new
password and blocks blind resubmission. The reset page is dynamic/no-store,
noindex and no-referrer; the browser removes the token query after hydration and
keeps it in the current client render rather than local/session storage.
Refreshing that page requires a new link.
Auth proxy callbacks forward only same-origin redirects, with no-store and
no-referrer. No tracking or third-party content is added to recovery pages.

Validate the seam without a database or real outbound messages:

```sh
pnpm --filter @flowmark/auth... build
pnpm --filter @flowmark/auth lint
pnpm --filter @flowmark/auth test
```

## Account security policy

Normal email/password signup and sign-in explicitly do not require a previously
verified address. Recovery proves control of the existing account mailbox by
requiring a valid, unused, time-limited provider link. No prior verification step
is required, and resetting a password does not mark the address verified as an
unrelated side effect. Optional email verification remains available through the
prepared callback, without automatic sign-in after verification.

The Drizzle auth adapter explicitly enables transactions. Token consumption,
prior-session revocation and the password write must commit together; a failed
write must leave the token usable for a deliberate retry and keep old sessions
valid. Reset identifiers are SHA-256 hashed using Better Auth's supported storage
option, scoped to `reset-password:`. Other verification identifiers keep their
existing representation, and the installed provider supports reading legacy
plain identifiers during adoption. No custom token/password implementation or
schema migration is introduced.

Dashboard password change requires the current password through the provider
and requests revocation of other sessions. Password recovery revokes all prior
sessions. Email change remains explicitly disabled until its separately scoped
confirmation/reauthentication flow is implemented; adding a delivery callback
must not enable it implicitly. Existing per-account, service and trusted-source
limits remain in place for recovery and verification requests.

The database-backed recovery suite exercises optional verification, generic
request responses including simulated delivery failure, hashed token storage, replay/concurrent
use, rollback on failed password write, expired/tampered links, old-session
revocation and unchanged user identity/verification state. Run it only through
`pnpm test:integration` against its managed disposable PostgreSQL target. These
checks do not replace deployed-delivery acceptance.

Reference guidance: [OWASP password recovery](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
and [Better Auth options](https://better-auth.com/docs/reference/options).

## Optional verification in account settings

Settings → Account displays the signed-in session's actual email verification
status and lets an unverified owner request/resend a confirmation link. This is
optional; signup, sign-in and normal app access remain unchanged. Request receipt
is not shown as verified status. Loading, expired sessions, failed status lookups,
expired/invalid links, delivery errors and throttling have explicit recovery.
Refresh status re-fetches the session instead of trusting a callback parameter.

Explicit verification mail uses the same Next.js-managed lifetime as recovery
notices. Anonymous known/unknown request responses stay generic even when the
provider submission fails; safe diagnostics retain delivery failures.

The client fixes the callback to its own account-settings route. Better Auth
validates recipients, signed-in email matching, callback origins and token expiry;
existing durable address/source/service limits still apply. The callback never
automatically signs in or switches the current browser's user. Provider email
verification links can be revisited idempotently until expiry; this is distinct
from the single-use password-reset token contract. There is no new token engine,
schema, hosted setting or additional verification requirement.

Contract tests cover callback construction and safe delivery failures; browser
checks cover status and feedback presentation. The managed HTTP/PostgreSQL
suite covers confirmation, wrong-browser session isolation, mismatched addresses,
untrusted callbacks, expired/tampered links and atomic resend limits. Tests use
in-memory mail capture; live inbox acceptance remains a separate rollout check.
