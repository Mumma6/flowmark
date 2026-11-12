# Compare two reported periods

SDK **0.3.0** adds `client.readPeriod` through `@flowmarkdev/node/read`, backed
by `POST /v1/read/period`. Package publication and the accepting API rollout
remain separate operations.

This answers one technical question: how a workflow's reported failure counts
and recorded duration changed between two explicit periods. It reuses the same
selection and calculations as Studio/MCP. It does not establish a cause or prove
current activity or business correctness.

```ts
import { createFlowmarkReadClient } from "@flowmarkdev/node/read"

const client = createFlowmarkReadClient({
  apiBaseUrl: process.env.FLOWMARK_API_URL!,
  readKey: process.env.FLOWMARK_READ_KEY!,
})
const response = await client.readPeriod({
  version: 1,
  kind: "period",
  projectId: "00000000-0000-4000-8000-000000000001",
  workflow: "invoice-review",
  currentStartedAfter: "2026-11-01T00:00:00.000Z",
  currentStartedBefore: "2026-11-08T00:00:00.000Z",
  previousStartedAfter: "2026-10-25T00:00:00.000Z",
  previousStartedBefore: "2026-11-01T00:00:00.000Z",
})
console.log(response.report.current, response.report.previous)
```

Both windows use run **start time**, with inclusive start and exclusive end, and
canonical UTC millisecond timestamps. Each is at most 31 days. The previous
window must end at or before the current one starts. Later terminal telemetry
updates the original start cohort. These are live reads, not a frozen snapshot.

The response echoes the selection and reports the supported capability as
`technical_period_windows`. Each window carries its bounds, total, finished,
completed and failed run counts, success rate, median and p95 recorded duration.
The success-rate denominator is finished runs; duration retains Studio's existing
observation rules. Null means unavailable, including statistics for an empty
population. An absent previous population is explicitly reported, without an
invented percentage change.

`coverage` reports open/no-terminal counts, whether the previous window has any
runs, and `durationObservationCounts: null`: the source does not expose that
sample count. An open run is not proof of activity. The two windows cover their
full selected populations; `continuation` is null. No cursor is accepted.

The `omissions` list explicitly names daily, operation, failure-group and workflow
catalog sections that this consumer does not request. Even very large sections
are not loaded and then trimmed. `evidence.periodPath` returns to Studio with the
same shared selection and exact current-window filters; it does not authorize
the viewer or switch their project.

Only the supported technical selection is accepted. Business/peer modes,
revisions, environment filters and extra fields are explicit errors, even when
another Studio/MCP query supports them. The read shares the run read's project
read key, separate durable admission counters, safe errors, cancellation and
8 KiB request / 64 KiB response / 15-second lifetime / 5-second SQL bounds.
See [run read setup and errors](./public-run-read.md) and
[ADR 0010](../decisions/0010-public-run-read-contract.md).

The existing `examples/read-run.ts` consumer now accepts either a run selection
or this period selection from a JSON file, using the same environment-only key
and command. Period mode prints empty/baseline guidance; it rejects a cursor
argument. No tRPC/router, database types or Effect runtime imports are needed by
the consumer.

See the [public documentation source](../../apps/docs/content/docs/public-reads.mdx)
for a complete local setup, exported types, error codes and compatibility rules.
