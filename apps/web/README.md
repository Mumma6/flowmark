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
- **Agent clients:** Codex, Cursor, Claude Code and custom-agent tabs show
  concrete setup/investigation prompts and link to real documentation.
- **SDK:** retained before/after code, copy feedback and expandable evidence.
  Runtime tests verify unchanged business calls, return values and thrown errors.
- **Mobile:** the shared Sheet manages navigation focus and Escape dismissal.

Static narrative stays in Server Components. Client boundaries own only local
interaction state. Shared controls come from `@flowmark/ui`; no new UI kit,
backend, dependencies or infrastructure are introduced. The removed legacy
sections/effects have no remaining consumers.

## Visual direction and verification

See [the design system](../../docs/design-system.md#product-10-landing-and-studio-direction).
The landing uses a dark charcoal canvas, system typography, restrained lime,
editorial headings, structural dividers and evidence-led product visuals.
It does not implement a light-theme switch. Semantic completion, attention and
failure colors remain distinct from brand emphasis.

Global CSS owns tokens, base rules and a short entrance keyframe. The entrance
is enabled only when motion is allowed; anchor scrolling respects reduced
motion. No animation dependency, scroll listener, remote font or image request
is required.

Verify desktop and mobile layouts, keyboard tabs, search/clear recovery, evidence
selection, cross-interface context, Dialog/Sheet dismissal and focus restoration,
SDK scenario switching and copying, FAQ expansion, anchor destinations, metadata
and the browser console. The synthetic landing needs no database or other app.
