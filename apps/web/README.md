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
It introduces the product through custom interactive diagrams and an evidence story.
Public access is through the waitlist; the site has no competing signup CTA.

Every product illustration uses fixed synthetic
observations; no example connects a repository, publishes a definition, runs an
agent, executes a test or reads an account. The marketing experience is not an
operational record of deployed capabilities.

## Composition

`app/page.tsx` composes server-rendered sections. The product feature owns its
interactive examples and fixtures:

- `process-landscape.tsx`: responsive application topology with animated evidence
  paths. Select executions and remove/restore an illustrative confirmation.
- `discovery-field.tsx`: independent agent-assisted, automatic and precision SDK
  entrances; a convergence diagram changes with its evidence source. Candidate
  review keeps human ownership explicit. The SDK example remains executable/tested.
- `journey-timeline.tsx`: connected booking request, customer lookup, submission and confirmation
  evidence, with an expandable execution timeline and a scroll-linked trace.
- `outcome-field.tsx`, `process-data.ts`: comparable 700-booking cohorts. Each of
  100 dots represents seven bookings. Confirmation changes from 644/700 (92%) to
  532/700 (76%); execution completion stays 695/700 and field coverage 700/700.
  Health rings retain these three separate dimensions. A keyboard-accessible
  table includes denominators, observation time and comparison boundaries.
- `evolution-experience.tsx`: a connected change/review/verification loop with
  an illustrative instrumentation patch and evidence checks. No customer work runs.
- `evidence-network.tsx`: selectable people/agent/tool perspectives connected to
  the same process meaning, with explicit authorization boundaries.
- `motion.tsx`, `process-icon.tsx`: landing-specific diagram primitives. Native
  SVG/CSS performs animation; React owns only selections and motion policy.
- `features/waitlist/`: existing Effect submission and environment isolation,
  with pending, error, unavailable and acknowledged-success presentations.

Keep pure fixture presentation in TypeScript and local interaction in React.
Actual data selection and deterministic platform computation retain their
PostgreSQL and Rust owners. Narrative stays in Server Components; interactive
boundaries reuse `@flowmark/ui` Button, Sheet, Accordion and Input.
No additional dependency or animation runtime is required.

## Visual and interaction conventions

See [the design system](../../docs/design-system.md#product-landing-direction).
Keep charcoal, restrained lime, lavender and system fonts. Oversized editorial
type, open sections and connected evidence define the page. Existing attributed
beam and spotlight effects remain behind the hero. Signal trails, orbit traces and
progressive timeline bars express observed relationships. Aceternity Background
Lines, Tracing Beam, Timeline, Moving Border and Glowing Effect informed the visual
research; the diagram implementation is original and uses no Motion dependency.

One subscription tracks reduced-motion preference and page visibility. Viewport
observers stop offscreen scenes. Reduced motion defaults to a complete static
experience, with an explicit **Play motion** opt-in for the diagram loops. **Pause
motion** stops every animation. Finite entrances, hover transforms and scroll-linked
traces retain CSS motion-safe guards; scroll traces fall back to complete lines
where view timelines are unsupported. No per-frame JavaScript or layout measurement
loop is used. Normal layouts use Tailwind and semantic tokens.

Verify 320/390 px mobile, tablet and desktop; no page overflow; keyboard activation
of diagram nodes, candidate review, SDK disclosure, journey evidence, cohort
selection/table, change-review stages, people/agent/tool perspectives and mobile
navigation. Check reduced-motion default, opt-in, pause, offscreen suspension,
metadata and console errors. All controls remain usable without animation.

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
