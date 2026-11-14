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

## Product experience

**Process intelligence for people and agents.** The landing presents Flowmark's
complete product vision: discover processes, observe execution and business
outcomes, understand meaningful changes, and maintain instrumentation as code evolves.
It introduces the product through a visual workspace, not a conversation.
Public access is through the waitlist; the site has no competing signup CTA.

Meridian Health is fictional. Every product illustration uses fixed synthetic
observations; no example connects a repository, publishes a definition, runs an
agent, executes a test or reads an account. The marketing experience is not an
operational record of deployed capabilities.

## Composition

`app/page.tsx` composes server-rendered sections. The product feature owns its
interactive examples and fixtures:

- `process-workspace.tsx`: Process Health, release comparison and a connected
  journey. A finding opens the comparison; its next action opens the journey.
  Inspecting a booking uses the existing shared `RunSnapshot` and Dialog.
- `process-data.ts`, `outcome-chart.tsx`: two seven-day cohorts of 700 eligible
  bookings, with 100 bookings per day. Confirmations fall from 644/700 (92%) to
  532/700 (76%). Completion is 695/700 (99.3%) in both; required-field coverage is
  700/700. All confirmation windows have elapsed at observation. Accessible
  tabular values and exact comparison boundaries accompany the chart.
- `discovery-experience.tsx`: independent Automatic, Agent-assisted and Precision
  SDK entrances. Candidate review distinguishes code inference from observed
  context and accepted meaning. The SDK tab keeps the executable, tested example.
- `evolution-experience.tsx`: inspect a changed handler, a proposed patch and a
  clearly illustrative local verification record. No action implies execution or
  deployment of customer work.
- `shared-understanding.tsx`, `evidence-network.tsx`: organization perspectives
  and the shared Studio/MCP/API evidence model. Permissions remain explicit.
- `features/waitlist/`: existing Effect submission and environment isolation,
  with pending, error, unavailable and acknowledged-success presentations.

Keep pure fixture presentation in TypeScript and local interaction in React.
Actual data selection and deterministic platform computation retain their
PostgreSQL and Rust owners. Narrative stays in Server Components; interactive
boundaries reuse `@flowmark/ui` Tabs, Button, Dialog, Sheet, Accordion and Input.
No additional dependency or animation runtime is required.

## Visual and interaction conventions

See [the design system](../../docs/design-system.md#product-landing-direction).
Keep charcoal, restrained lime, lavender and system fonts. Oversized editorial
type, open sections and connected evidence define the page. Existing attributed
beam and spotlight effects remain behind the hero. SVG chart drawing and all
entrance/ambient motion are guarded by `prefers-reduced-motion`; anchor scrolling
also respects it. Normal layout uses Tailwind utilities and semantic tokens.

Verify 320 px and 390 px mobile, tablet and desktop widths, horizontal overflow,
tab keyboard activation, candidate review, code copy, evidence Dialog dismissal
and focus restoration, mobile navigation, team perspectives, FAQ, metadata and
console errors. Chart data is available as a table. Programmatic changes from a
finding to another tab move focus to that tab.

For waitlist browser checks, use a temporary loopback HTTP fixture or the local
stack. Exercise pending, rejected/malformed responses, retry and acknowledged
success without writing synthetic addresses into a hosted database. Unit tests
cover request credentials, response validation and environment isolation.

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
