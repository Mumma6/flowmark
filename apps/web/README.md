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

“Know what your workflows actually accomplish” leads with application-reported
results. Completion and business results remain separate facts. The central
example is a customer import: 1,000 received, 988 imported, 12 skipped, with a
handled CRM rate limit. Flowmark observes application-owned work; it does not
execute, schedule, or retry it. Open-source/MIT is secondary context in source
links and the footer, not the main value proposition.

The public landing describes the intended product experience in present tense,
including outcome analytics, business-reference search, and expectations. It is
product storytelling rather than a release-status page; roadmap sections and
availability labels are kept out of the marketing UI. This does not change the
SDK/API contracts or the implementation status tracked separately in product
planning. The analytics panel uses sample data, not a live query or a screenshot
of shipped analytics.

Never claim independently verified business correctness or infer active work,
terminal failure, or root cause from missing telemetry alone.

## Composition and shared product UI

`app/page.tsx` composes Server Components: hero, completion/result distinction,
investigation and execution trends, business outcomes and team perspectives,
positioning, developer examples, FAQ, product-led closing and footer. Metadata
and generated Open Graph artwork use the same positioning.

The main product demonstration uses **the same `RunSnapshot` component** exported
by `@flowmark/ui` and rendered in the dashboard's `RunInvestigation`. The landing
passes static illustrative props in `workflow-demo.tsx`; the dashboard projects
recorded events with `buildRunSnapshot` in `run-snapshot-presentation.ts`. The
shared component owns run identity/status, result metrics, milestone selection,
payload inspection, and last-reported progress. Dashboard actions, raw results,
full timeline, operations, comparisons and related runs remain available.

`RunSnapshot` is the narrow client boundary; the surrounding fixture and page
composition are server rendered. It uses keyboard-operable shared Buttons,
unique evidence IDs, an announced detail region, bounded payload overflow,
semantic status colors, and native progress. It holds no API clients, secrets,
or data-fetching logic. Web dark tokens and system fonts match the dashboard;
shared classes are compatible with Tailwind 3 and 4.

`mobile-navigation.tsx` uses the shared Sheet with focus management and Escape
dismissal. `code-showcase.tsx` retains the before/after application scenarios,
code copying, and expandable evidence. Code-example tests execute both versions
against controlled helpers and check preserved behavior and line budgets.
All illustrations are static fixtures; no work is executed, no telemetry is
sent, and no customer data or credentials are needed.

The hero reuses the original decorative Spotlight, Spotlight Wash, Background
Beams, Meteors, and subtle grid/dot treatments. The effects are CSS/SVG, clipped
to the hero background, hidden from assistive technology, and never intercept
pointer input. Meteors disappear under reduced motion; beams and spotlights
become static. Existing source attributions remain in the effect components.

Global CSS contains theme tokens, base rules and animation keyframes. Smooth
anchors and arrival motion respect reduced-motion preferences. Hover and
selection feedback use CSS transitions. No timers, scroll listeners, remote
font requests, animation dependencies, or backend changes are needed.
