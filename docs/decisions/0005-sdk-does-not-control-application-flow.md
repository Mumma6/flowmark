# ADR 0005: The SDK observes; application code controls flow

- Status: accepted

## Decision

The fundamental SDK API is additive marker calls (`workflow`, `step`, `done`, `fail`). It does not require callbacks, wrappers, framework adapters, or an execution engine.

## Rationale

Developers should instrument existing business logic without restructuring it. The application already knows what each semantic milestone means.

## Consequences

Transport sits behind an injectable Effect service. Effects are executed at the
SDK boundary; marker delivery and diagnostic failures must not escape into host
application logic. Explicit `flush()` and `shutdown()` promises report delivery
failures at lifecycle boundaries.

The optional Next.js adapter binds delivery to `after()`; the browser entry
supports direct public-key delivery or an optional same-origin backend proxy.
Neither integration takes control of business execution. `defineConfig()` is a
typed, side-effect-free settings helper, not a workflow definition or execution
engine.
