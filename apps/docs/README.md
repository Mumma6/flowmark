# Flowmark documentation

The public documentation app uses Next.js, Fumadocs, and MDX. It documents
agent access, runtime memory, SDK integration and local development.

## Run and validate

```bash
pnpm --filter @flowmark/docs dev
pnpm --filter @flowmark/docs test
pnpm --filter @flowmark/docs lint
pnpm --filter @flowmark/docs typecheck
pnpm --filter @flowmark/docs build
```

Development defaults to port 3002. Both `/` and `/docs` lead to the introduction.
Existing documentation URLs are preserved.

## Content structure

Lead with the change, agent access and evidence semantics. Keep SDK examples as a technical reference for agents and adapters. Document today's Studio access controls and implementation limits accurately. The [product contract](../../docs/product.md) owns the target.

MDX lives in `content/docs`. Each folder's `meta.json` controls sidebar order
and grouping. The SDK reference has its own nested navigation with client,
run-marker, and advanced groups. The layout provides top-level menus, mobile
navigation, breadcrumbs, in-page contents, and previous/next links.

Page titles and descriptions come from frontmatter; do not repeat them as
Markdown H1s. Begin content headings at H2. Use absolute `/docs/...` links
for cross-section references.

Search uses the existing Fumadocs index through `app/api/search/route.ts`.
Code blocks, heading anchors, and internal links use Fumadocs' MDX renderer.
Retain the documentation framework's integrated navigation rather than copying
its controls into the app. New general-purpose application UI should go through
the shared `@flowmark/ui` package.

## Accuracy and regression checks

Check SDK claims against `packages/sdk/src`, its package exports, and core
schemas before editing reference pages. Distinguish configuration/start errors
from marker delivery diagnostics. Keep application execution/retry ownership
and best-effort telemetry boundaries explicit.

The built-in Node tests check internal document/anchor links, navigation
coverage, single-title content, API reference coverage, and selected snippet
contracts against the SDK source. They add no runtime/test dependencies.
Production builds validate MDX generation and every static documentation route.

Public guides own user journeys. Repository `docs/` owns deeper contracts,
architecture and operations; link to those owners rather than copy their full
implementation details into each guide. Client configuration claims require
version-specific evidence; an MCP endpoint or copied instruction is not a
verified connection.
