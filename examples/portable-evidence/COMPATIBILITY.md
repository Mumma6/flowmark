# Portable evidence compatibility record

Observed **11 November 2026**, against Flowmark staging source `b2ff20a`
(PR #169 merged), with the public sample/verifier in this example's change.
This records local synthetic compatibility, not a hosted rollout or a universal
MCP client certification.

## Exact environment

| Component                   | Observed version / scope                                                                                                         |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| MCP Apps host               | Official Basic Host v2.0.4, upstream `7af9a75da720b8a81be0f9aff47b25f75e9530ad`, plus the supplied `reference-host.patch`        |
| Host SDK                    | `@modelcontextprotocol/ext-apps@2.0.4`                                                                                           |
| Host MCP client/core/server | 2.3.1 / 2.3.1 / 2.3.1                                                                                                            |
| Host build                  | Vite 6.4.4; locked Bun 1.3.10                                                                                                    |
| Non-UI client               | `@modelcontextprotocol/client@2.3.1`; verifier identity `Flowmark synthetic non-UI verifier` 1.0.0; empty capabilities           |
| MCP profile                 | 2026-07-28; Streamable HTTP on loopback                                                                                          |
| Local fixture               | `Flowmark synthetic evidence fixture` 0.1.0; `pages` mode; no database or credentials                                            |
| Runtime                     | macOS 15.6.1 arm64; Node 24.15.0; npm 11.12.1                                                                                    |
| Browser runner              | Codex in-app browser; its engine build was not exposed by the DOM inspection API                                                 |
| Endpoints                   | Fixture `127.0.0.1:8099`, host `127.0.0.1:8080`, sandbox `localhost:8081`, supplied host `127.0.0.1:3004`, docs `127.0.0.1:3002` |

The reproduction used a fresh temporary checkout of the exact upstream commit,
materialized from a local Git object cache. The public patch applied cleanly.
Dependency installation used the local npm cache with scripts initially disabled;
`npm rebuild bun`, SDK build and Basic Host build all succeeded. The resulting
temporary upstream lockfile SHA-256 was:

```text
3f68d550dd3f85049f3719391245a6076c6ac609889f3ee290ae694679b074ef
```

This equals the previously accepted reference-host probe. No host workaround or
Flowmark dependency update was introduced in this verification. The unmodified
upstream host is not the tested configuration: it has older peers and lacks the
UI capability declaration.

## Evidence and observed behavior

The MCP selection was synthetic project
`00000000-0000-4000-8000-000000000001`, run
`00000000-0000-4000-8000-000000000002`, section `events`, effective page limit 50.
The result reported Completed execution, 1.20 s duration and four event records
across two pages. No business-success conclusion was inferred.

- **Actual host render:** the nested sandbox displayed the shared run snapshot,
  initial-page coverage and withheld business fields; no mocked renderer.
- **Actual evidence interaction:** Shift-Tab reached **Next events page**, Enter
  replaced the two initial events with `synthetic-result` / `synthetic-completed`
  on the continuation page. Scope references and limit stayed fixed; the final
  next-page control disabled. Refresh retained the continuation-page selection.
- **Presentation/lifecycle:** both host themes rendered. A dedicated 390 px
  browser viewport had a 335 px evidence frame with equal scroll width, so no
  horizontal overflow. Closing the view removed the frame. Keyboard focus and
  semantic button/status/heading roles were visible to the accessibility API.
- **Non-UI fallback:** the real SDK client advertised no UI capability and
  received no UI association on `get_run`. It read both pages, four distinct
  event records, valid project/run references and the final null cursor. Each
  page's complete text JSON deeply equalled its `structuredContent`; fallback
  did not depend on rendering the App or decoding presentation props.
- **Supplied-data sample:** the actual `snapshot.json` file was pasted into the
  built local harness and rendered with its event reference, partial coverage,
  withheld fields and no-final-outcome meaning intact. Invalid replacement JSON
  removed the snapshot and displayed an explicit error. The package test checks
  that the public file still passes the real harness boundary.
- **Public guide:** the built `/docs/portable-evidence` page rendered in the
  documentation sidebar with its setup/compatibility links. Its 390 px layout
  had no horizontal document overflow. Internal link/anchor/navigation and SDK
  snippet checks passed.

The verifier's observed summary was:

```json
{
  "client": "@modelcontextprotocol/client@2.3.1",
  "protocol": "2026-07-28",
  "server": {
    "name": "Flowmark synthetic evidence fixture",
    "version": "0.1.0"
  },
  "uiCapability": false,
  "projectId": "00000000-0000-4000-8000-000000000001",
  "runId": "00000000-0000-4000-8000-000000000002",
  "pagesRead": 2,
  "eventsRead": 4,
  "totalEvents": 4,
  "textStructuredParity": true,
  "lastCursor": null
}
```

## Limits and availability

| Surface                                                   | Verified status                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Patched Basic Host above                                  | Local synthetic rendering and interaction observed                                                      |
| Non-UI SDK client above                                   | Complete text/structured two-page fallback observed                                                     |
| Supplied-data harness                                     | Public sample and invalid replacement observed locally                                                  |
| Unmodified Basic Host                                     | Not claimed compatible with Flowmark's required protocol/capability profile                             |
| Codex, Cursor, Claude and other commercial MCP Apps hosts | Flowmark integration not verified here; using Codex's browser runner is not a Codex MCP App integration |
| Hosted Preview / staging / production MCP Apps            | Not verified or enabled by this example                                                                 |

All evidence was fixed synthetic content. The frame presents allowlisted metadata
but can receive raw diagnostic fields from its authorized host; this is not a
business-safe redaction boundary. The view has no credentials, persistent storage,
direct fetch, analytics, polling or automatic retry. The host delegates explicit
reads through existing live authorization/admission. A copied result cannot detect
unseen revocation. Invalid/revoked/expired access handling is implemented and
separately exercised by the lifecycle tests and recorded in
[ADR 0011](../../docs/decisions/0011-mcp-app-evidence-boundary.md); this synthetic
fixture is not proof of a real grant's lifecycle.

Browser zoom shortcuts did not change the in-app viewport; true 200% browser zoom
was not verified in this run. OS screen-reader and reduced-motion settings were
not changed or certified. No layout or interaction component was changed by this
documentation/example task. Broader assistive/browser certification is outside
this compatibility claim.

The example's [README](./README.md) contains the exact setup and failure modes.
The [official MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview)
and [pinned Basic Host source](https://github.com/modelcontextprotocol/ext-apps/tree/v2.0.4/examples/basic-host)
were consulted; general extension support is not evidence of a particular
Flowmark/client combination working.
