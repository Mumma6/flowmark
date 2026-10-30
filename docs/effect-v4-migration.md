# Effect v4 migration

The repository uses Effect 4.1.0 in core, SDK, persistence, API, server,
dashboard and the local development harness. All seven consumers pin the same
exact version because the HTTP and Schema APIs include unstable surfaces.
`@effect/platform` is removed; HTTP modules come from `effect/http`.

This document describes the repository change. It does not announce an npm
release or authorize publishing, deployment or hosted database operations.

## Compatibility

The ordinary SDK calls, Promise boundary, package export paths and telemetry
wire contract are preserved. Existing event JSON, context/result limits,
operation behavior and delivery policies remain the baseline. No database
schema or applied migration changes are part of this migration.

Advanced integrations must migrate alongside the SDK/core packages:

- Custom `WorkflowTransport.emit` implementations now return an Effect v4
  `Effect`; v3 Effects and Context keys are not interchangeable with v4 values.
- Exported core schemas use the v4 Schema API. Use `typeof MySchema.Type`,
  `Schema.decodeUnknownEffect` or `Schema.decodeUnknownResult`, and
  `Schema.toStandardSchemaV1` as appropriate.
- Effect error internals change: `Cause` has a flat `reasons` array, HTTP errors
  wrap a typed `reason`, and v4 Promise execution exposes raw failures rather
  than v3's FiberFailure wrapper. SDK diagnostic tags and HTTP status reporting
  remain available; code inspecting underlying Effect failures must migrate.
- Persistence services use explicit `.layer` constructors instead of generated
  `.Default` layers. API use cases still acquire dependencies at their existing
  application boundary.

Coordinate the next core/node release and document the advanced integration
changes before publishing. Package versions are not bumped by this PR.

## Implementation details

Services use `Context.Service`; resource acquisition uses `Layer.effect` with
`Effect.acquireRelease`. `Result` replaces `Either`, and error handling uses
`Effect.catch` / `catchCause`. Protocol adapters inspect individual Cause reasons
and keep composite or defect-bearing failures internal. Diagnostic logging copies
only approved labels rather than serializing causes.

Run-local state is a separate `RunState` service, resolved with `yield*` inside
the run lifecycle. The run creation boundary provides a local state layer for
every start, isolating it from enclosing memoized layers. State transitions
manage completion requests and operation membership; lifecycle coordination
records terminal events. This keeps both modules small without extra runtimes.

The fetch layer captures fetch explicitly per client/request. V4 caches
`Context.Reference` defaults, including the default fetch implementation; relying
on that default would reuse the first implementation across otherwise independent
clients. A regression test covers two clients with separate fetch implementations
and credentials. Browser options remain scoped to their own clients.

Delivery retains one managed runtime per client, run-local ordering, a 1,000-event
queue limit, bounded retries, stable retry event IDs, timeouts, request cancellation
and explicit flush/shutdown errors. UUID validators keep the established hexadecimal UUID shape instead of v4's
stricter RFC version/variant check. A comparison of 5,663 valid/invalid decodes
against v3 matched after this adjustment; focused regression tests cover event,
operation and tRPC identifiers. The pre-existing pending-completion property
behavior documented in [architecture](./architecture.md) remains unchanged.

## Measured SDK costs

These are synthetic local measurements on Node 24.15.0, macOS arm64, comparing
staging `f1de422` (Effect 3.22.4) with this migration. They are not production
latency, browser load-time or capacity guarantees.

- Browser export bundle (`createFlowmark`, `defineConfig`), minified ESM with
  installed esbuild 0.28.2: 492,349 → 451,608 bytes; gzip level 9:
  154,319 → 145,728 bytes (about 5.6% smaller over the wire).
- Mocked HTTP delivery of 100 runs / 700 events, median after three warmups
  over nine samples: 126.86 → 59.84 ms (about 53% lower elapsed time).
- Heap retained with the same 700 deliveries blocked, after forced GC:
  15,003,184 → 8,169,656 bytes. This is one sample of retained heap,
  not peak RSS or a statistically established production memory reduction.

The runtime benchmark creates an independent client for each sample and verifies
the expected event count and absence of diagnostics. Fetch is mocked, so no
server or database is contacted. Reproduce after building SDK/core:

```sh
pnpm --filter @flowmarkdev/core build
pnpm --filter @flowmarkdev/node build
node --expose-gc scripts/benchmark-sdk.mjs
node --expose-gc scripts/benchmark-sdk.mjs /absolute/path/to/v3/sdk/dist/index.js
```

Build the same browser export wrapper against each revision with
`--bundle --minify --platform=browser --format=esm`, using the same esbuild
version, then compare byte lengths and gzip output. Keep each revision's matching
core/Effect dependency graph; do not point the v3 build at v4 dependencies.

## References

- [Official migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md)
- [Service migration](https://github.com/Effect-TS/effect/blob/main/migration/services.md)
- [Schema migration](https://github.com/Effect-TS/effect/blob/main/migration/schema.md)
- [Layer memoization](https://github.com/Effect-TS/effect/blob/main/migration/layer-memoization.md)

Consult the installed package sources and declarations when examples differ
from the pinned version.
