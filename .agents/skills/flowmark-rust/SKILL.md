---
name: flowmark-rust
description: Write, review or extend Flowmark Rust functionality, crates, Cargo tooling and TypeScript/WASM boundaries. Use for existing or proposed Rust responsibilities across Flowmark, including the Evidence Engine; ordinary TypeScript and infrastructure retain their own skills.
---

# Flowmark Rust

Rust is a permanent, first-class architectural option. Apply
[architecture](../flowmark-architecture/SKILL.md#choose-the-responsibility-and-language-owner)
to choose among TypeScript/Effect, PostgreSQL and Rust. Learning, functional
programming, polyglot design and craftsmanship are valid benefits; weigh them
with cohesion, integration cost and maintainability. No performance bottleneck
is required, and Rust is not an automatic choice.

Future Rust modules and crates may own cohesive computations, analysis, event/data
processing, graph algorithms, statistics or other justified responsibilities.
The Evidence Engine is the first use, not a permanent limit. Read
[its guide](../../../docs/evidence-engine.md) for the current integration, and
apply [Effect](../flowmark-effect/SKILL.md) when changing TypeScript integration.

## Ownership

- Group domain models and small responsibility-named modules by cohesive behavior.
  Keep serialization and runtime bindings separate. The current crate uses
  `model.rs`, `operations.rs` and `wasm.rs`; future crates need no identical template.
- Pure domain code takes explicit inputs and returns values or `Result`, without
  clocks, I/O, configuration or application runtimes. If a future responsibility
  needs effects, give them an explicit adapter and owner rather than hiding them
  inside deterministic rules. TypeScript/Effect normally owns orchestration.
- For the current engine, persistence retrieves authorized ordered evidence,
  API use cases coordinate calculations, and the TypeScript package owns loading,
  contracts and typed failures. Persistence does not import the engine or API.
- Keep public core/SDK contracts independent of WASM initialization. Give migrated
  rules one production implementation; do not add a silent TypeScript fallback.

## Rust style

- Model closed vocabularies with enums and handle them exhaustively with `match`.
  Use `Option` for absence and a specific error enum for expected failures.
- Prefer borrowed slices/strings, immutable bindings, iterator transformations,
  `filter_map`, `fold`, `try_fold` and `collect::<Result<_, _>>()` where clear.
  Local mutable collections are appropriate for indexing and accumulation.
- Keep inputs unchanged. Return owned outputs when ownership must cross a boundary;
  borrow within a calculation to avoid cloning whole records.
- Use `?` and contextual boundary errors. Avoid `unwrap`/`expect` on input-dependent
  paths. Tests may unwrap. Explain invariants for unavoidable internal assertions.
- No shared mutable state, interior mutability, unsafe code, async runtime or
  generic computation framework for pure calculations.
- For evidence processing, preserve input ordering, first-seen output order, nullable
  observations and legacy numeric behavior. Hash iteration is not output order.
  Completed is not verified business success; missing telemetry proves no liveness.

## Boundary and verification

- Keep serialization DTOs outside domain models. Version cross-language contracts
  and validate decoded output in TypeScript. The current engine uses a private
  JSON envelope; precision, nulls, enum spelling and ordering are explicit decisions.
- Use the pinned toolchain and locked Cargo dependencies. For wasm-bindgen
  integrations, align library and CLI versions. Generated bindings/WASM are build outputs.
- Add shared fixtures for preserved behavior and native property tests for actual
  invariants. Do not assume order independence for an ordered evidence stream.
- Run `pnpm rust:check` and affected crate/consumer tests. For current engine
  loader/build changes, run `pnpm evidence:verify-build` and relevant API/integration
  checks. Other integrations need appropriate artifact verification too;
  compilation alone is insufficient.
- Additional Rust functionality or crates need a clear responsibility, explicit
  contract and independent tests. Extend the current engine only when the work
  belongs to it; reuse the Cargo workspace/toolchain and integrate each crate's
  relevant build checks. Leave SQL aggregation/filtering in PostgreSQL unless its
  complete responsibility is deliberately migrated; preserve drilldown parity.
