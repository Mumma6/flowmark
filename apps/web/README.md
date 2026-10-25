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

The website runs at `http://localhost:3000`. In development, documentation
links point to `http://localhost:3002/docs/introduction`. In a deployment, set
`NEXT_PUBLIC_FLOWMARK_DOCS_URL` to the published documentation URL; the
production fallback is `/docs/introduction` for deployments that route docs
under the same origin. The dashboard is a separate development-only
application and is not linked from the public landing page. These local
services are not hosted signup destinations.

If port 3000 is already in use, Next.js reads `PORT` to override the website's
development port (the default remains 3000). Other apps use explicit ports and
are unaffected:

```sh
PORT=3100 pnpm --filter @flowmark/web dev
# Or start all apps with the same website override:
PORT=3100 pnpm dev
```

The landing page consumes shared shadcn-style Button, Accordion, Card, and Tabs
primitives and the shared code-block components exported by `@flowmark/ui`.
Purpose-built product illustrations stay local to the app. The
`components.json` configuration registers the official Aceternity UI registry.
Its Spotlight component stays local to this app, is attributed in source, and
is subject to the Aceternity License; review that license before redistributing
the source. The dashboard illustration is explicitly illustrative and uses
synthetic invoice values, not live or customer data. No credentials are needed
by the website.

## Component organization

`app/page.tsx` composes the landing sections from `app/components/`. The hero,
value proposition, instrumentation introduction, architecture, FAQ, and closing
sections are separate server components, alongside the site header/footer and
app-specific brand and dashboard illustration.

The interactive code showcase is the client boundary. Its example content
lives in `code-examples.ts`, with separate `workflow-code-block.tsx` and
`run-preview.tsx` renderers. Tabs, FAQ accordions, cards, code blocks, and CTA
buttons all come through `@flowmark/ui`; the shared Tabs and Accordion
implementations use Base UI. No app-local replacement controls are needed.

The showcase is organized around invoice imports, supplier inventory syncs,
and order fulfillment rather than SDK method categories. Each scenario pairs
the same business function before/after instrumentation with a readable run
outcome and expandable evidence. Displayed runs are static walkthrough fixtures;
clicking them does not execute application work or contact the local harness.
Only a footer identifies the sample data; event details retain the distinction
between application reports and verified business state.

The scenario tests execute both versions of each displayed function with
controlled application helpers, check preserved return/error behavior, and
enforce the small instrumentation line budget. Setup and advanced SDK
capabilities remain in documentation, not additional landing-page tabs.

`app/globals.css` imports styles grouped under `app/styles/`: base/theme,
dashboard illustration, landing sections, code showcase, and responsive/motion
rules. Responsive overrides load last to preserve the cascade.

The page remains primarily server-rendered. The restrained spotlight respects
reduced-motion preferences.
