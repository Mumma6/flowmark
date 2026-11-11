# Portable run evidence

Two local reproductions of the shared `RunSnapshot`: a supplied JSON host and
an MCP App in the official Basic Host. All sample content is synthetic. Neither
example executes application work or needs an ingestion key or database.

## Supplied-data example

From a configured Flowmark checkout with dependencies installed:

```sh
pnpm exec turbo build --filter=@flowmark/dev-harness...
pnpm --filter @flowmark/dev-harness start
```

Open `http://127.0.0.1:3004/evidence`. Copy the contents of
[`snapshot.json`](./snapshot.json) into **Supplied snapshot JSON**, then choose
**Render supplied evidence**. Select the progress milestone to inspect its event
reference. The same shape is exported by Studio → Timeline → Table →
**Portable evidence snapshot** for an authorized selected run.

The sample deliberately has no final outcome, withheld business payloads, a
partial event page and explicit coverage. The host only validates and renders
supplied JSON; it does not fetch, refresh or authenticate that snapshot. Invalid
replacement JSON clears the view. No content is saved or sent by the page.

The shared package is private repository code, not a published embeddable npm
SDK. A custom host can reuse `RunSnapshot` and the existing supplied-snapshot
boundary within this workspace; it must obtain authorized data independently.

## Synthetic MCP fixture and non-UI fallback

Build the fixture's workspace dependencies before starting it:

```sh
pnpm exec turbo build --filter=@flowmark/mcp...
pnpm --filter @flowmark/db exec tsx ../mcp/scripts/synthetic-evidence-host.ts
```

The second command uses the existing repository `tsx` executable. It performs no
database operation. The fixture binds only `127.0.0.1:8099`; it is never mounted
by the application and is not an authorization test. It exposes fixed synthetic
project/run references and the real generated view/resource adapter.

In another terminal, run the actual MCP client without UI capability:

```sh
pnpm --filter @flowmark/db exec tsx ../mcp/scripts/verify-synthetic-fallback.ts
```

This verifier has a fixed loopback destination and no credential input. It checks
the fixture identity before reading, absence of a UI association, two distinct
event pages, project/run references, continuation/end cursors and complete
text/structured result parity. A nonzero exit is a failed reproduction.

## Approved reference host

The observed host is **Basic Host v2.0.4**, upstream commit
`7af9a75da720b8a81be0f9aff47b25f75e9530ad`, with the explicit
[`reference-host.patch`](./reference-host.patch). This is a patched reference
host result, not a claim of unmodified upstream or commercial-host support.

The patch aligns MCP client/core/server peers to 2.3.1, pins the existing
2026-07-28 protocol profile, advertises the UI MIME capability at both Client
constructors, and binds the host/proxy listeners to loopback. It leaves the
upstream AppBridge, renderer and sandbox security code unchanged. The original
host lacks the capability declaration and uses older peers; do not bypass
Flowmark's capability or protocol checks to make it render.

Clone into a separate temporary directory. In the Flowmark checkout, first
record its absolute path:

```sh
FLOWMARK_EXAMPLE_ROOT="$PWD/examples/portable-evidence"
REFERENCE_HOST_DIR="$(mktemp -d -t flowmark-reference-host)"
git clone https://github.com/modelcontextprotocol/ext-apps.git "$REFERENCE_HOST_DIR"
cd "$REFERENCE_HOST_DIR"
git checkout --detach 7af9a75da720b8a81be0f9aff47b25f75e9530ad
git apply --check "$FLOWMARK_EXAMPLE_ROOT/reference-host.patch"
git apply "$FLOWMARK_EXAMPLE_ROOT/reference-host.patch"
npm install --package-lock-only --ignore-scripts
npm ci --ignore-scripts
npm rebuild bun
npm run build
npm run build --workspace @modelcontextprotocol/ext-apps-basic-host
SERVERS='["http://127.0.0.1:8099/mcp"]' node_modules/.bin/bun examples/basic-host/serve.ts
```

Use Node >=20.19 and npm; the host's own lockfile supplies Bun for its build and
server. Its dependencies stay outside Flowmark. The dependency-alignment step
updates the temporary upstream lockfile: record its hash and resolved versions
when repeating a compatibility result. An unexpected SDK incompatibility calls
for review, not an unrecorded workaround or security change.

Open `http://127.0.0.1:8080`, choose `get_run` and **Call Tool** with the displayed
synthetic defaults. If a reloaded URL invokes the tool before defaults load,
close that failed view and call again with the populated inputs.

- Inspect the `started`/`progress` event references and explicit withheld/partial
  coverage. Completed describes reported execution, not every record's success.
- Use **Next events page**: the continuation replaces the initial page and its
  final-page button disables. **Refresh this page** rereads the displayed page.
  Both actions keep the same project/run/events context and effective limit.
- The host keeps the full tool result separately. The frame projects event
  metadata only; raw diagnostic fields can enter the frame through the host and
  this is not a business-safe redaction boundary.
- Test keyboard operation, both themes and a narrow viewport. Close the view to
  exercise teardown. The iframe has no direct network path or credentials.

To reproduce failed navigation, stop only your fixture and restart it with
`FLOWMARK_SYNTHETIC_EVIDENCE_MODE=access-unavailable` (or `unavailable` or
`scope-mismatch`) prefixed to its command. Make a fresh host selection, then
request the next page. The snapshot and actions clear. Expiry, revocation and
changed access are intentionally not distinguished by guessing error text.
Unseen revocation cannot be detected from copied data; every real read rechecks
live access. No automatic fetching, retry or polling is added.

Stop your host/fixture/harness processes with Ctrl-C. Inspect existing listeners
before starting and leave other sessions' processes and Compose/data alone.
Never deploy these local-only hosts or use existing telemetry in this smoke.

See the dated [compatibility record](./COMPATIBILITY.md) and
[ADR 0011](../../docs/decisions/0011-mcp-app-evidence-boundary.md). MCP Apps is an
[optional host extension](https://modelcontextprotocol.io/extensions/apps/overview);
Flowmark source support does not establish hosted availability or compatibility
with an untested client/version.
