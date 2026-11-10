# Read a selected run

The source implementation adds `@flowmarkdev/node/read`. It requires an npm
release containing this subpath; publication is a separate release step.
The endpoint is `POST /v1/read/run` on the configured API deployment. Source
availability does not imply that a hosted environment has been updated.

Create a **read key** in Studio → Settings → API keys for the selected project.
The secret is shown once. Store it in the server environment; write keys, browser
keys, cookies and MCP OAuth tokens cannot authenticate this endpoint. Revoke an
API key from the same settings page to deny subsequent reads. Already authorized
requests may finish.

```ts
import {
  createFlowmarkReadClient,
  FlowmarkReadError,
} from "@flowmarkdev/node/read"

const client = createFlowmarkReadClient({
  apiBaseUrl: process.env.FLOWMARK_API_URL!,
  readKey: process.env.FLOWMARK_READ_KEY!,
})

const result = await client.readRun({
  version: 1,
  kind: "run",
  projectId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  section: "events",
  limit: 50,
})

console.log(
  result.summary.status,
  result.summary.durationMs,
  result.page.events,
)
// Explicit continuation: repeat the same selection with page.nextCursor.
// Catch FlowmarkReadError for code, HTTP status and optional retry delay.
```

These are ordinary TypeScript types and Promises. Consumers do not import a
tRPC router, database types or the Effect runtime. `readRun` accepts an optional
`{ signal: AbortSignal }` argument. Aborts and failures reject; the client never
retries or turns an error into empty evidence.

The API base URL is explicit, supports a self-hosted path prefix and requires
HTTPS except on loopback. Redirects and ambient cookies are disabled. The Studio
origin can be different: `evidence.runPath` is a relative scoped navigation link,
not permission to read a project.

## Evidence and limits

- One run and one ordered event metadata page; default 50, maximum 100 events.
- No event properties, result objects, error stacks or external IDs. The
  `omissions` field names intentionally absent payloads and business results;
  this is not a business-safe projection guarantee.
- Status and duration are reported evidence. `Running` does not prove activity;
  `Completed` does not prove business correctness. A null duration stays unknown.
- An existing run without retained events returns an empty page. Missing or
  foreign runs return 404; a key from a different project returns 403.
- Cursors keep full database timestamp precision, are checked against the
  authorized run and never grant authority. An altered/foreign/deleted anchor
  fails with `INVALID_CURSOR`; explicitly restart after retention removes it.
- Reads are live, not snapshots. Concurrent ingestion may change counts; late
  arrivals before a cursor require a fresh traversal.
- Requests are capped at 8 KiB, responses at 64 KiB, the request/client lifetime
  at 15 seconds and each SQL statement at 5 seconds. An oversized response fails
  explicitly; request fewer events. Service/project/key admission is durable.

This run endpoint rejects unsupported sections, period queries and extra filters rather
than dropping them. Errors have a stable code and optional retry delay; 429 also
includes `Retry-After`. The full DTO, status mapping and compatibility policy are
in [ADR 0010](../decisions/0010-public-run-read-contract.md).

## Run the repository consumer

Build the local API/core dependencies, start the API through the repository's
normal development workflow, and save a Studio run selection as `selection.json`.
Use an actual local project read key through environment configuration:

```sh
pnpm --filter @flowmark/api... build
pnpm --filter @flowmark/db exec tsx --tsconfig ../../examples/tsconfig.json ../../examples/read-run.ts /absolute/path/selection.json
```

Set `FLOWMARK_API_URL` and `FLOWMARK_READ_KEY` before running. Optionally set
`FLOWMARK_STUDIO_URL` to print a return link. Never pass the key as an argument
or put it in the selection file. An optional second argument is the exact cursor
returned by the previous read. The script prints empty-page guidance, accepts
Ctrl+C cancellation and reports safe error codes. It does not fetch a return
link, poll, ingest evidence, seed data or execute application work.

The same client and CLI also support [technical period comparison](./public-period-read.md)
through `readPeriod`; the run endpoint continues to accept only run/events selections.

See the [public documentation source](../../apps/docs/content/docs/public-reads.mdx)
for a complete local setup, exported types, error codes and compatibility rules.
