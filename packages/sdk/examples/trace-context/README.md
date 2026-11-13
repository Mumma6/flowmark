# Explicit trace references

This application-side recipe connects reported business evidence to an existing
technical span. It uses ordinary operation properties and the convention in
[ADR 0020](../../../../docs/decisions/0020-explicit-trace-references.md), with no
SDK API change or tracing integration. The recipe uses the repository's existing
Effect 4 dependency for synchronous validation and `Result`; it is not an SDK export.

## Use an already-configured tracer

Copy [recipe.ts](./recipe.ts) into your application. Supply a reader from your
existing tracer; Flowmark does not install a context manager or capture tracing
automatically. For an application already using OpenTelemetry, that reader can be
`() => trace.getActiveSpan()?.spanContext()`. No OTel package is needed by this
recipe or its synthetic proof.

```ts
import type { FlowmarkClient } from "@flowmarkdev/node"
import { traceOperationOptions, type ReadSpanContext } from "./recipe.js"

export async function handleBookingRequest(
  client: FlowmarkClient,
  runId: string, // Persisted application process ID, never a trace ID.
  readCurrentSpan: ReadSpanContext,
  requestConfirmation: () => Promise<number>,
) {
  const flow = client.workflow("booking.create", { id: runId })
  const confirmed = await flow.operation(
    "request confirmation",
    requestConfirmation,
    traceOperationOptions(readCurrentSpan, "booking-api"),
  )
  // The application decides when the whole process is finished.
  flow.done({
    outcome: confirmed > 0 ? "confirmed" : "no-availability",
    result: { confirmed },
  })
  return confirmed
}
```

Evaluate the options immediately before **each** operation, inside the current
request/span context. Do not cache options globally or reuse a previous request's
reference. Parallel operations get fresh references. Continuing the same workflow
name and run ID in another request records that request's span on its operation.
It can emit another `started` event; ingestion keeps the original start metadata.
Do not call `setProperties` to replace the run's trace with each request's trace.
If the whole process is not finished, omit `done()` until its final handler.

An initial run may separately record one starting reference using
`captureTraceProperties`; it does not describe every later request. Trace IDs,
run IDs, `correlationId` and `parentRunId` have separate meanings. Neither trace
identity nor technical span status determines the reported business result.

## Selected data and unavailable evidence

Only `traceId`, `spanId` and an explicit, stable `serviceName` are selected into
`properties.traceContext`. IDs must be nonzero lowercase hexadecimal (32/16
characters). Service names are 1–80 ASCII letters/digits, dots, underscores,
slashes or hyphens, starting with a letter/digit. They are application constants,
not request/customer/user data. The complete selected object is at most 256 UTF-8
bytes; normal SDK property limits also apply.

Missing/invalid context or a throwing reader omits the optional reference. It does
not change the work's value, original rejection or business outcome.
`captureTraceProperties` returns a typed local unavailable reason; it retains no
tracing exception. No baggage, attributes, request bodies, headers, credentials,
trace state, sampling flags or arbitrary URLs are copied or fetched.

Syntax is not provenance. Browser/remote context is untrusted and grants no access
to Flowmark or your tracing backend. References remain diagnostic evidence under
existing project permissions, without automatic business publication. A sampled-away,
expired or missing span means **unavailable evidence**, not success, failure or a
complete trace. Tracing authentication and retention remain separately owned.

## Run the synthetic proof

From the repository root after the normal dependency setup:

```sh
pnpm --filter @flowmarkdev/node test trace-context
pnpm --filter @flowmarkdev/node typecheck
```

The [fixture](../../test/trace-context.fixture.ts) uses the actual SDK with injected
`MemoryTransport`, an application-owned synthetic context reader and three owned
synthetic spans. It records overlapping operations, continues the same run in a
later request and reports `partial` with zero confirmed bookings even though the
technical spans report `ok`. Tests resolve each operation's full trace/span/service
tuple against that fixture and correlate the operation terminal by its operation
ID. A tuple absent from the fixture stays unavailable. The tests also cover
malformed/missing context, throwing readers, selected-field bounds, preserved
application values/errors and the absence of HTTP calls. No credentials, database,
real telemetry or tracing provider are needed.

In an existing authorized diagnostic run, open **Events** and expand the operation's
start event to see its recorded `traceContext` JSON. Use that full tuple to look up
the span in your separately authorized tracer. This proof adds no Studio link,
search index or external lookup. An owned local component fixture can pass the
memory events to the existing `RunEventTimeline` to check this display without
ingestion or a hosted account.
