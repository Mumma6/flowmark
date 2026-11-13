# Rust Evidence Engine

Rust is a permanent, first-class part of Flowmark's architecture. The Evidence
Engine is its first production integration and currently owns deterministic
operation-evidence summarization. Future Rust functionality and crates may serve
other cohesive responsibilities; this engine does not define the language's scope.

[Language and responsibility ownership](./architecture.md#typescript-postgresql-and-rust)
weighs TypeScript/Effect, PostgreSQL and Rust by cohesion, integration cost and
maintainability. Learning, functional programming, polyglot design and craftsmanship
are valid reasons to choose Rust without a performance bottleneck. The current
engine uses WASM inside the existing backend and needs no hosted service,
database or additional runtime process.

## Ownership

- `crates/flowmark-evidence`: pure models, occurrence folding and interpolated
  percentiles. Domain modules use borrowed inputs, enums, `Option` and `Result`;
  no database, HTTP, configuration or clock. Serde and WASM exports live in `wasm.rs`.
- `packages/evidence-engine`: private ESM package with typed contracts, boundary
  validation, an Effect `EvidenceEngine` service and a lazy loading layer.
- `packages/db`: selects project-scoped peers and ordered operation facts. It
  returns comparison evidence and does not import the engine or API.
- `packages/api`: coordinates those reads with the engine and assembles the
  existing diagnostic/business comparison contracts. Runtime composition supplies
  the engine layer. Public core and SDK packages have no WASM dependency.

This crate is the sole production implementation of occurrence summarization and the
in-memory percentile calculation. PostgreSQL continues to own cohort filtering,
historical aggregate percentiles, coverage classification and weighted ratios.
The two percentile contexts are intentional; no raw cohort export is introduced.

## Evidence semantics

Input order is authoritative. Persistence orders facts by occurred time, created
time and event UUID. The engine preserves first-seen occurrence and name order.
A later start never reopens an occurrence; the last terminal event replaces its
status and duration, including null. Names retain their first observed value.
Terminal-only evidence remains present. Repeated names retain occurrence,
open/failed counts, median and total recorded duration. The legacy `durationMs`
field remains the longest duration with its existing zero floor.

Percentiles use linear interpolation at `(n - 1) * p`; empty samples are null.
Finite fractional/negative legacy durations retain their arithmetic. Non-finite
values, invalid percentiles and non-finite computed results fail explicitly;
JavaScript serialization must not silently convert them to null. This is not a
new telemetry admission policy. Recorded operation time is not parallel wall time,
open evidence does not establish liveness, and completion is not business success.

## Build and test

Use pinned pnpm. Commands work from the repository root:

```sh
pnpm rust:setup
pnpm rust:format
pnpm rust:check
pnpm rust:build
pnpm exec turbo build --filter=@flowmark/evidence-engine
pnpm --filter @flowmark/evidence-engine test
pnpm evidence:verify-build
pnpm test:integration
```

`rust:setup` installs the pinned Rust toolchain, rustfmt, Clippy and WASM target.
`rust:check` checks formatting, denies Clippy warnings and runs native tests and
properties. `scripts/rust.mjs` provisions tools under ignored `.cache/rust/` by
default and never changes a shell profile. Explicit `CARGO_HOME`/`RUSTUP_HOME` may
select an existing installation. Rust is pinned in `rust-toolchain.toml`; Cargo
uses its committed lockfile. The wasm-bindgen CLI matches the crate's exact
version. Initial builds require official Rust downloads and crates.io access.

Native property tests need no database; integration tests use disposable Compose
PostgreSQL. Shared JSON fixtures were captured from the previous TypeScript
calculation and run in native Rust and real Node/WASM tests.

`pnpm dev` retains its existing TypeScript watchers and builds WASM at the startup
barrier. To change Rust, stop the dev session you own, run `pnpm rust:build`, then
restart it. There is no additional Rust watcher or background build process.

## WASM packaging

Rust targets `wasm32-unknown-unknown`. wasm-bindgen's `web` output lives in
ignored `packages/evidence-engine/wasm/`. A generated Node ESM entry embeds the
compiled bytes as base64 and calls `initSync` without fetch or filesystem reads.
The loader dynamically imports that entry; the module cache initializes its WASM
instance once per worker. The service layer is lazy, so unrelated API operations
do not load WASM. Versioned JSON envelopes carry plain data across the boundary;
TypeScript decodes both envelope and result. Initialization, input, invocation,
output and calculation failures remain tagged `EvidenceEngineError` values.

The workspace build runs Rust before TypeScript. Turbo hashes root Cargo files,
crate sources and the build script, and caches both `dist/` and `wasm/`.
Next.js bundles the ESM entry, carrying its WASM bytes into the server chunk,
and explicitly traces the generated assets from the monorepo root. This avoids
workspace externalization and filesystem-path assumptions. Base64 adds roughly
one third to the binary size before compression. Runtime code never downloads or compiles Rust. Synchronous
WASM occupies the Node thread; this integration adds no worker pool.

`pnpm evidence:verify-build` builds the actual server, checks its tRPC function
trace, copies only traced dependencies into a temporary artifact, and runs every
fixture through the generated binding in that artifact. A fresh process with
the embedded-byte entry removed must fail loading; Effect adapter tests separately
verify that loading failures become typed initialization failures. Run the verifier with the production Node 22
binary as well when changing bindings or runtime requirements. `pnpm check`
includes Rust checks and artifact verification, so existing PR CI exercises the
integration without hosted credentials. No deployment is performed.

## Adding Rust functionality

Choose the responsibility and owner first. Extend this engine when the work
belongs to evidence computation; another cohesive responsibility may merit its
own module or crate in the Cargo workspace. Keep pure domain logic independent
of runtime integration, favor idiomatic functional Rust and define explicit
input/output/error contracts with independent tests.

For an engine calculation, add a pure module and tests, extend the narrow WASM
boundary and expose the typed service method. Keep its I/O and authorization in
the TypeScript/Effect application layer. Preserve precision, nullability and
ordering in shared fixtures. Migrating a rule removes its old production
implementation; migrating a SQL-backed rule also addresses filtering, aggregation
and evidence drilldown parity. Future Rust integrations should choose their
boundary deliberately rather than copy this WASM mechanism automatically.

Follow the repository's `flowmark-rust` skill for implementation conventions.
