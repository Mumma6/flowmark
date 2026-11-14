# Flowmark website

The public product introduction, built with the Next.js App Router. Run commands
from the repository root:

```sh
pnpm --filter @flowmark/web dev
pnpm --filter @flowmark/web lint
pnpm --filter @flowmark/web typecheck
pnpm --filter @flowmark/web test
pnpm --filter @flowmark/web build
```

The website defaults to `http://localhost:3000`. When it is occupied, use an
available loopback port without restarting another service:

```sh
pnpm --filter @flowmark/web dev --hostname 127.0.0.1 --port 3100
```

In development, documentation links default to
`http://localhost:3002/docs/introduction` and the dashboard to
`http://localhost:3001`. Deployments default to the public Flowmark origins.
`NEXT_PUBLIC_FLOWMARK_DOCS_URL` and `NEXT_PUBLIC_FLOWMARK_APP_URL` override them.

## Product story

“Understand what your software actually does.” Flowmark is open-source process
intelligence for people and agents. Platform, Studio and Everywhere describe one
product: instrument application-owned work, collect evidence, and understand
technical and reported business outcomes over time.

The landing presents the complete Product 1.0 in present tense, including the
Studio, agent/MCP and portable-interface experience. It is also the visual
blueprint for those product surfaces. This narrative does not establish the
operational state of a deployed tool, authorize a connection or execute work.
Source inventories and setup guides retain their actual implementation status.

Meridian Health is a fictional reference organization. Two fixed synthetic cases
show a completed booking with an unobserved confirmation and a completed referral
batch with mixed results. There is no patient data, live account, API request,
OAuth flow or telemetry submission in these examples. Missing evidence does not
establish failure; technical completion does not verify business correctness.

## Composition and interactions

`app/page.tsx` composes the server-rendered narrative, navigation, FAQ, closing and
footer. `features/product-landing/` owns the Studio illustration, fixtures,
organization perspectives, agent examples and product story. Metadata and the
generated Open Graph image use the same identity.

- **Studio:** search by process, customer, integration or reference; recover from
  no matches; switch investigations; inspect connected evidence. “Inspect run”
  opens the existing shared `RunSnapshot` in a shared Dialog.
- **Agent / structured data:** view the active investigation as a cited example
  answer or structured evidence document. The answer's evidence button returns
  to that case in Studio. These are local illustrations, not live agent calls.
- **Organization:** five role perspectives read the same synthetic booking,
  without implying five independent products or permission grants.
- **Agents:** one client-independent conversation pairs a concrete question with
  synthetic process evidence. Codex, Cursor, Claude Code and other MCP clients
  share the same story; no redundant client tabs, MCP call or connection state.
- **Portable evidence:** switch between MCP App and internal-tool illustration
  shells, then inspect the same synthetic booking in the shared run Dialog.
- **Platform:** a server-rendered evidence-to-client diagram connects the SDK,
  process meaning, Studio, MCP and custom tools. It illustrates the product
  model rather than inventing a wire/API contract.
- **SDK:** one executable booking example connects code to customer/integration
  context, a reported business result and a separate confirmation expectation.
  Expandable evidence explains those signals. Runtime checks verify the original
  result/error and forwarded confirmation reference, including a negative result.
- **Mobile:** the shared Sheet manages navigation focus and Escape dismissal.

Static narrative stays in Server Components. Client boundaries own only local
interaction state. Shared controls come from `@flowmark/ui`. The waitlist reuses the existing API,
database and pinned Effect dependency; no new UI kit or infrastructure is introduced. The story and product
navigation follow Studio → Platform → Everywhere, then organization perspectives
and questions. The closing invitation carries the open-source/self-host message;
there is no separate open-source feature section. Unused legacy sections
remain removed. The earlier `SpotlightWash` and
`BackgroundBeams` decorations are reused behind the hero, with their source
attributions preserved.

## Visual direction and verification

See [the design system](../../docs/design-system.md#product-10-landing-and-studio-direction).
The landing uses a dark charcoal canvas, system typography, restrained lime,
editorial headings, structural dividers and evidence-led product visuals.
It does not implement a light-theme switch. Semantic completion, attention and
failure colors remain distinct from brand emphasis.

Global CSS owns tokens, base rules, the short entrance and slow light/beam
keyframes. Decorative light cones and lines never receive pointer input or
accessibility focus; their motion is enabled only when motion is allowed. Studio
uses a lime rim light, soft ambient glow and stronger selected-state accents.
Anchor scrolling respects reduced motion. No animation dependency, scroll
listener, remote font or image request is required.

Verify desktop and mobile layouts, keyboard tabs, search/clear recovery, evidence
selection, cross-interface context, Dialog/Sheet dismissal and focus restoration,
SDK evidence expansion and copying, FAQ expansion, anchor destinations, metadata
and the browser console. The synthetic product illustrations need no database or other app. Waitlist
submissions use the existing Studio/API stack described below.

### Color hierarchy

Lime remains the brand and primary action color. The `highlight` token adds
restrained lavender to Studio identity, navigation and decorative light; it
never replaces execution or outcome status colors. Studio uses a darker violet
in its light theme to preserve text contrast. Keep these accents sparse.

## Waitlist

The hero links to an email form in the closing section. It submits without cookies
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
authentication, invitation, confirmation email or admin interface is involved.

The existing database-backed limiter caps valid waitlist submissions at 120 per
minute per database across instances. It returns HTTP 429 with `Retry-After` when
full. This deliberately simple shared budget does not identify individual bots
or protect against sustained traffic exhausting that budget. No forwarded IP,
raw email or new credential is used for the limiter key. Invalid bodies are bounded
by the API's existing 64 KiB reader. Database failures return HTTP 503 and never
look like successful joins; the client supports retry without creating duplicates.

Apply committed migration `0032_brief_sphinx` before rolling out the API/landing
change, following [database rollout](../../docs/migrations.md). This work does not
authorize a hosted migration or deployment. Each environment uses its own existing
database. The form has loading, accessible success/error states and a 10-second
network timeout. No submitted address or request body is written to application logs.
