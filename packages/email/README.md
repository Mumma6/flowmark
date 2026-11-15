# `@flowmark/email`

Private, server-only transactional email using Effect 4 and Resend's HTTP API.
There is no extra provider SDK. This package prepares delivery; it does not
enable identity flows itself. `@flowmark/auth` owns the provider callbacks, and
`apps/server` composes delivery when the mail settings below are present.
Native Better Auth email change stays disabled so that path cannot bypass the
verified email-change coordinator. Normal access does not require prior
verification.

## Use at a server composition boundary

```ts
import { Effect } from "effect"
import { Email, resendLayer } from "@flowmark/email"

const submission = Email.use((email) =>
  email.send({
    kind: "reset-password",
    to: "person@example.com",
    messageId: crypto.randomUUID(),
    actionUrl: providerGeneratedResetUrl,
    expiresInMinutes: 30,
  }),
)

// Run and await at the request boundary, not in a detached background Promise.
const result = await Effect.runPromise(
  submission.pipe(Effect.provide(resendLayer(process.env))),
)
// result.status === "submitted" means API acceptance, not inbox delivery.
```

Add a `workspace:*` dependency in the server consumer when wiring these flows.
Never import from client code. The conditional package export rejects browser
resolution. There is no public endpoint or automatic send on package import.

Required live settings (missing or invalid values fail with `EmailError`):

| Variable                     | Meaning                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| `FLOWMARK_EMAIL_ENVIRONMENT` | Required: `production`, `staging`, `preview` or `local`                               |
| `RESEND_API_KEY`             | Server-only sending key, kept redacted in parsed settings                             |
| `FLOWMARK_EMAIL_FROM`        | Bare mailbox on a verified sending domain; environment-specific Flowmark display name |
| `FLOWMARK_EMAIL_REPLY_TO`    | Bare monitored reply mailbox; may use another domain                                  |
| `BETTER_AUTH_URL`            | Existing canonical dashboard origin, reused for link validation                       |

HTTPS is required except on loopback. Links must resolve to that configured
origin without embedded credentials. Never derive the origin from request Host
headers. Callers must use provider-generated URLs and actual provider expiry.
The template set is `verify-email`, `reset-password`, `change-email`,
`security-notice` (`password-changed` or `email-changed`) `waitlist-welcome`, and `delivery-test` for
the explicit Staging delivery check. No arbitrary subject,
HTML, attachments, batch recipients or security-notice body is accepted.

Every logical message needs an opaque UUID `messageId`. Preserve it **and the
entire payload** for a deliberate retry; never put a token or recipient in it.
Resend retains idempotency keys for [24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys).
There are no automatic retries: network failure, timeout, invalid success
response or interruption may happen after submission. Do not mint a new ID and
retry blindly; inspect provider status or use the same ID/payload within that
window. A 429 or other non-success HTTP response includes its status in a typed
failure. The adapter bounds submission and response parsing to ten seconds,
aborts on timeout/interruption, and refuses redirects.

Errors omit recipients, bodies, raw provider messages, bearer URLs and keys.
Log only the error's operation/reason/status and an opaque request ID. Never log
input, rendered messages, request headers, parsed settings or provider bodies.

## Local capture

```ts
import { makeEmailCapture } from "@flowmark/email"

const check = Effect.gen(function* () {
  const capture = yield* makeEmailCapture("http://localhost:3000")
  yield* submission.pipe(Effect.provide(capture.layer))
  const messages = yield* capture.read
  // Assert recipient and HTML/text in memory. Do not log or persist bearer URLs.
  yield* capture.clear
  return messages.length
})
```

Capture performs the same validation/rendering, deduplicates identical messages
and rejects conflicting payloads for an existing ID. Its state belongs to one
caller and does not model Resend's 24-hour expiry. Use synthetic recipients and
tokens. Never use capture as a hosted fallback. Local unit tests need neither
Docker nor a real key:

```sh
pnpm --filter @flowmark/email test
pnpm --filter @flowmark/email typecheck
pnpm --filter @flowmark/email lint
pnpm --filter @flowmark/email build
```

For a separately approved real Staging check, inject the reviewed Staging env
values into the process and run:

```sh
pnpm --filter @flowmark/email send:test --send --to your-controlled-recipient@example.com --message-id 12345678-1234-4234-8234-123456789abc
```

Generate a fresh UUID for a new logical test; preserve it and the entire payload
for any deliberate retry. The command refuses a non-Staging canonical origin,
sends exactly one allowlisted test message and prints only submission metadata.
It does not claim an account change or include an auth token. There is no local
env loader or fallback to hosted secrets. An explicit test recipient and key
must be supplied through the approved operator flow; no real sends happen in
the test suite.

## Hosted activation and delivery checklist

Pulumi owns env bindings, secrets, domain configuration and persistent provider
settings. See [email bindings](../../infrastructure/README.md#transactional-email-bindings)
and the [environment catalog](../../infrastructure/environments.md#transactional-email-staging-and-production).
No provider account, DNS record, webhook or tracking setting is created by this
package. Adopt the relevant Resend/DNS resources into the existing Pulumi
project before changing them; do not configure manually and reconcile later.

Recorded operation, with the steps that are still open named separately:

- The maintainer owns sending. Production sends as `accounts@flowmark.dev` and
  Staging as `staging@flowmark.dev`, both on the verified `flowmark.dev` domain
  in `eu-west-1`, with open and click tracking disabled. Reply-to and the
  incident mailbox are `flowmark.dev@gmail.com`. That Gmail address is not an
  owned sending domain. SPF, DKIM and the four sending DNS records are verified.
  DMARC is not declared by this package.
- One controlled Staging `delivery-test` was accepted by Resend and confirmed in
  that inbox before the branded templates. Provider acceptance is not inbox
  delivery. No Production inbox check is recorded. Resend's
  [test recipients](https://resend.com/docs/dashboard/emails/send-test-emails)
  simulate events and count against quota; they do not prove inbox placement.
- The current Resend plan, included quota, processing terms and recurring price
  are not stored in this repository. Do not infer a free tier or a paid
  commitment from the presence of bindings. A numeric cost record remains an
  operator decision.
- No bounce or complaint webhook is implemented. Do not bypass a suppression
  with another send. Recovery for a lost password uses the password-reset flow.
  Monitoring is an operator review of the provider event for a known message,
  plus the guarded Staging CLI. There is no alert destination and no outbox.

Do not send with a dummy key, and do not treat a stored Pulumi secret as proof
that a new environment can deliver mail.

## Branded templates

Every message shares `src/templates/layout.ts`: Flowmark's lowercase wordmark
with its established accent dot, dark lockup, resolved green theme colors,
a readable white content area, an action button, expiry/security guidance,
and a visible fallback URL. The wordmark is live text so branding still works
when remote images are blocked; there are no image, font or tracking requests.
The plain-text alternative stays complete.

HTML email is a separate rendering boundary from the web apps. Tables and inline
CSS are intentional compatibility measures; React/shadcn components and runtime
Tailwind classes cannot be pasted into a delivered email. Colors are resolved
from the dashboard's light theme and the shared wordmark, with their source
noted in the layout. The responsive wrapper uses a bounded 560px width and
Outlook table fallback. Browser previews are not proof of identical rendering
in every email client; Gmail/Outlook inbox checks remain separate live evidence.
See [Gmail CSS support](https://developers.google.com/workspace/gmail/design/css).

## Environment distinction

Production uses `Flowmark <accounts@flowmark.dev>`. Staging uses
`Flowmark Staging <staging@flowmark.dev>`, a `[Staging]` subject prefix and a
visible environment notice in both HTML and plain text. Preview/local are also
labeled. Each submission carries a Resend `environment` tag. Idempotency keys
include the environment. Links are checked against that environment's existing
`BETTER_AUTH_URL`; Production and Staging do not share dashboard links.

One verified `flowmark.dev` domain supports both sender mailboxes without extra
DNS. Reply-to stays the monitored Gmail address; these sender addresses do not
create inbound mailboxes. Separate sending keys distinguish credentials, but
the shared domain retains shared reputation and domain-level permissions.
Production's sending-only, domain-scoped key is a Pulumi resource with its token
stored encrypted in state and delivered directly to the Production API binding.
Staging's existing key stays in encrypted nonprod config. General Preview stays
disabled. Environment bindings do not deploy application code or enable auth
callbacks. The recorded inbox test predates these branded/environment variants.

## Waitlist welcome

`waitlist-welcome` uses a dedicated dark charcoal/lime/lavender HTML template and a plain-text alternative. Its CTA is the fixed public marketing URL, never a bearer or account link. Nonproduction subjects and HTML are visibly labeled. API acceptance is not proof of inbox delivery.

The waitlist use case persists an opaque registration UUID as its message identity and records provider acceptance. Repeated accepted registrations do not resend. Ambiguous/failed attempts reuse the same recipient, identity and fixed template for at most 23 hours after the first attempt, leaving a margin inside Resend’s 24-hour retention. After that window, the request fails closed for operator reconciliation rather than minting a new ID and risking a duplicate. No automatic retries, background sending or historical bulk mail are introduced. New template revisions must not be substituted for an uncertain payload during reconciliation.
