# Shared run evidence view

Private presentation package for Studio, the local supplied-data harness and an
MCP App. It observes supplied evidence; it never executes application work.

- `@flowmark/evidence-view/projection`: `buildSuppliedRunSnapshot`, the shared
  metadata-only projection into existing `RunSnapshotProps`.
- `@flowmark/evidence-view/snapshot`: `decodeSuppliedSnapshot`, the pasted-JSON
  boundary used by the local harness.
- `@flowmark/evidence-view/resource`: fixed resource URI, static HTML and empty
  external-origin CSP declarations. The browser entry uses the official MCP
  Apps SDK and the existing `@flowmark/ui/run-snapshot` component.

`get_run` keeps its complete existing text/structured result. A client advertising
`text/html;profile=mcp-app` in the 2026-07-28 per-request capability envelope also
gets the UI association. Other clients continue with text/structured evidence.
The static resource is read through the authenticated MCP endpoint; each read
checks the live connection and admission budget. The view receives data through
the host channel and has no API client, credentials or persistent storage.
Explicit refresh and next-events-page actions use the host's `get_run` connection
for the same validated project/run/events context. There is no polling or retry.
A supplied-data host without server-tool capability still renders the snapshot
with disabled read controls.
Only the events section has a visual projection. Other sections retain their
full fallback rather than being interpreted as empty event pages.

The host can forward raw diagnostic fields in its existing authorized result.
The view renders only event metadata and coverage, withholding business payloads
from presentation. This is not a business-safe redaction boundary. A copied
result does not prove current access, freshness or business correctness.

## Checks

Run `pnpm --filter @flowmark/evidence-view build`, `typecheck`, `lint`, and `test`.
Build before direct tests. Turbo orders package checks against its build.
The build emits a self-contained HTML resource and an importable static module;
it fails above 1 MiB UTF-8 or if external assets, eval or private server modules
enter the browser graph. Tool requests/results keep their existing 64 KiB bound.
SDK console calls are removed from the production browser bundle.

The resource adds a restrictive meta CSP (hashed script, no connections, forms,
frames or external resources) in addition to the host's enforced sandbox/CSP.
The selected web host uses a separate-origin proxy and a nested iframe. Treat
host context as presentation input only; arbitrary CSS variables/URLs are ignored.
Results must match the supplied invocation and valid bounded page coverage.
Invalid replacements, errors, cancellation, connection closure and teardown
clear evidence and actionable read references. Pending host reads are scoped,
abort on replacement/cancellation/closure, and cannot restore superseded results.
Access failures explain that authority may have expired, been revoked or changed;
the view does not guess which. Reconnect or select authorized evidence in the host
to resume. Cleanup releases the SDK transport and resize observer.

`src/controller.ts` adapts SDK messages to the Effect queue and supplies the
`EvidenceReader` service. `src/session.ts` owns per-view `Ref` state and scoped
read fibers. `src/tool-result.ts` validates completed results before retaining
only metadata and bounded navigation references; `src/lifecycle.ts` owns the
presentation states and typed read failures.

## Local synthetic reference-host smoke

See [ADR 0011](../../docs/decisions/0011-mcp-app-evidence-boundary.md) for exact
approved versions, source revision, temporary host adaptations and evidence.
Start the fixture from the repository root only for local development:

```bash
pnpm --filter @flowmark/db exec tsx ../mcp/scripts/synthetic-evidence-host.ts
```

This uses the existing repository `tsx` tooling; it performs no database operation.
It binds `127.0.0.1:8099`, has no credentials/database and serves fixed synthetic
evidence plus the real resource adapter. It is never mounted by the application.
Point the approved reference host at `http://127.0.0.1:8099/mcp`, call `get_run`
with its displayed synthetic defaults, then inspect refresh, next page,
milestones, theme and close. The next page replaces the previous page and ends
pagination; refresh rereads the displayed page. To exercise failed navigation,
start a new owned fixture process with `FLOWMARK_SYNTHETIC_EVIDENCE_MODE` set to
`access-unavailable`, `unavailable` or `scope-mismatch`, reload the host and select
synthetic evidence again. These modes deny/fail/mismatch the next page while the
first page remains valid. Stop only the fixture/host processes you started.
Use ordinary authenticated MCP access to test real authorization separately;
the synthetic fixture is not an authorization proof. Never deploy or expose it.

The [public portable-evidence example](../../examples/portable-evidence/README.md)
provides a copyable snapshot, exact reference-host setup/patch, non-UI verifier
and dated compatibility record. The [public guide](../../apps/docs/content/docs/portable-evidence.mdx)
describes source availability and disclosure limits.
