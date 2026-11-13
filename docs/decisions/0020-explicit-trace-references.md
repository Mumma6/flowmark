# ADR 0020 — Explicit application-owned trace references

- Status: Accepted for local implementation
- Date: 2026-11-13
- Task: Product SDK-003
- Inspected baseline: staging `ac806c7`

## Proposed collection convention

An application may explicitly select one existing span reference into ordinary
Flowmark properties. The recipe owns `properties.traceContext` with exactly:

```json
{
  "traceContext": {
    "traceId": "11111111111111111111111111111111",
    "spanId": "2222222222222222",
    "serviceName": "booking-api"
  }
}
```

`traceId` is 32 lowercase hexadecimal characters; `spanId` is 16. Each must be
nonzero, following the [OpenTelemetry SpanContext representation](https://opentelemetry.io/docs/specs/otel/trace/api/#spancontext).
`serviceName` is an explicit application constant, separate from SpanContext:
1–80 ASCII letters, digits, dots, underscores, slashes or hyphens, starting with
a letter or digit. Do not derive it from a request, customer or user. The entire
selected property object is capped at 256 UTF-8 bytes, within existing SDK bounds.
These are example-owned names, not new reserved wire fields or SDK exports.

Select only those three values into a fresh object. Do not spread a tracing
context, resource attributes, baggage, headers, request bodies, tokens, URLs,
trace state, sampling flags or arbitrary error objects into properties.
[Baggage has no built-in integrity guarantee](https://opentelemetry.io/docs/concepts/signals/baggage/#baggage-security-considerations)
and is not an authorization or safe-data boundary.

## Identity and optional instrumentation

The application keeps its existing tracing setup. The recipe receives an injected
reader of the current span context plus its explicit service name. It adds no
OTel dependency, exporter, global context manager, automatic patching, propagation
or network destination. It never creates trace/span IDs or uses them as run IDs.

An initial run may record its starting reference once. Each operation captures
the current reference explicitly at operation start through existing operation
properties. A continued run retains its original workflow/run identity and start
metadata; later requests record their own operation-local references. Never
overwrite a run-level reference to suggest it describes every request. Parallel
operations must retain independent references. `correlationId` and `parentRunId`
keep their existing application-owned meanings.

Absent/invalid context, an invalid service constant or a failed context reader
omits the optional reference. Application work, its return value, thrown error and
reported business outcome remain unchanged. A local selection result may explain
why a reference is unavailable; do not capture the tracing error or fabricate IDs.
Business outcome/result comes only from application reporting, never span status.

## Evidence and trust

References stay ordinary diagnostic properties, using existing read permissions
and property display. Do not publish them automatically into business projections,
saved business captures or public views. No new search index or Studio link widget.
Valid syntax does not prove provenance; browser/remote context is untrusted and
never grants access to a run, another project or a tracing backend.

The proof resolves the full trace/span/service tuple only against a small owned
synthetic trace fixture. A missing or sampled-away span is unavailable evidence,
not proof of success/failure or a complete trace. Do not follow user-supplied URLs
or add a hosted-provider lookup. Existing tracing backends retain their separate
authentication, sampling and retention policies.

## Scoped implementation and verification after acceptance

Add one typed application-side recipe and runnable in-memory proof, using the
existing SDK transport injection. Verify selected-field bounds, zero/invalid and
missing contexts, reader failure, concurrent operations and continued requests.
Match an explicitly reported business result to the synthetic trace evidence and
show the properties through the existing diagnostic view with owned synthetic
data. Document run versus trace identity, trust, sampling and unavailable evidence.

No SDK behavior/export, core event field, database/schema, control-plane API,
dependency or hosted setting changes. No npm publication or deployment. Local
synthetic tests only; no real telemetry or external model/provider calls.

## Acceptance

The maintainer approved the trace-reference convention on 2026-11-13, including
these names, bounds, optional-failure behavior and operation-local semantics.
Approval covers the recipe and local synthetic proof only.
