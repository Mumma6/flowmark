# Flowmark website

The public product introduction, built with the Next.js App Router. Run from the
repository root:

```sh
pnpm --filter @flowmark/web dev --port 3100
pnpm --filter @flowmark/web lint
pnpm --filter @flowmark/web typecheck
pnpm --filter @flowmark/web test
pnpm --filter @flowmark/web build
```

The development server binds to loopback. Inspect existing processes before
starting it, and stop the owned watcher before running builds or checks.
Documentation defaults to `http://localhost:3002/docs/introduction` and the
waitlist proxy to `http://localhost:3001/api/waitlist` during development.
`NEXT_PUBLIC_FLOWMARK_DOCS_URL` and `NEXT_PUBLIC_FLOWMARK_APP_URL` retain their
existing environment-specific overrides.

## Product messaging

The landing page introduces **application memory for AI-native software teams**. The hero diagram joins repository context with observed application behavior. The loop shows how production history informs the next change. The [page copy](public/landing-page-copy.en.json) includes the diagram labels, FAQ and waitlist states. The [product contract](../../docs/product.md) owns positioning and the [implementation inventory](../../docs/implementation-status.md) owns availability.

Use the shared controls, viewport-aware signal paths and reduced-motion presentation. Keep the main explanation visible without interaction.

## Waitlist

The header links to an email form in the closing section. It submits without cookies
to `/api/waitlist` on the existing `NEXT_PUBLIC_FLOWMARK_APP_URL` Studio origin
(local default: `http://localhost:3001`). The dashboard uses its existing API proxy;
no database credentials or new hosted settings are needed in the web app.
Preview uses the existing sibling-dashboard resolver; Staging requires its
configured Staging origin. Missing or Production-targeting Preview metadata
disables the form instead of submitting to Production. The
public write-only proxy permits cross-origin requests without credentials.

The API validates, trims and lowercases addresses. PostgreSQL's unique index on
`lower(email)` makes concurrent duplicates safe. Every accepted submission returns
`{ "ok": true }`, including existing addresses, without revealing membership. No
authentication, invitation or admin interface is involved. The API submits a branded
welcome through the existing Resend adapter and records provider acceptance before
acknowledging success. Repeated accepted registrations do not resend. Temporary
failures preserve the registration and stable message identity for a bounded retry;
expired uncertain deliveries require operator reconciliation. Provider acceptance
is not proof of inbox delivery.

The existing database-backed limiter caps valid waitlist submissions at 120 per
minute per database across instances. It returns HTTP 429 with `Retry-After` when
full. This deliberately simple shared budget does not identify individual bots
or protect against sustained traffic exhausting that budget. No forwarded IP,
raw email or new credential is used for the limiter key. Invalid bodies are bounded
by the API's existing 64 KiB reader. Database or email-submission failures return HTTP 503 and never
look like successful joins; the client supports retry without creating duplicates.

Apply committed migrations `0032_brief_sphinx` and `0033_majestic_imperial_guard` before rolling out the API/landing
change, following [database rollout](../../docs/migrations.md). This work does not
authorize a hosted migration or deployment. Each environment uses its own existing
database. The form has loading, accessible success/error states and a 10-second
network timeout. No submitted address or request body is written to application logs.
