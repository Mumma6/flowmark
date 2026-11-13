---
name: flowmark-rust
description: Write, review or extend Flowmark Rust evidence calculations and their WASM/TypeScript boundary. Use for crates/flowmark-evidence, the Cargo workspace, or packages/evidence-engine; not ordinary TypeScript or infrastructure work.
---

# Flowmark Rust

Rust owns deterministic evidence calculations. Read [the engine guide](../../../docs/evidence-engine.md)
and the nearest tests before changing behavior. Apply [architecture](../flowmark-architecture/SKILL.md)
and [Effect](../flowmark-effect/SKILL.md) when changing TypeScript integration.

## Ownership

- Keep domain models in `model.rs`, calculations in small responsibility-named
  modules, and serialization/WASM exports in `wasm.rs`. `lib.rs` exposes the crate.
- Domain code takes explicit inputs and returns values or `Result`; no clocks,
  I/O, environment configuration, HTTP, databases or application runtimes.
- Persistence retrieves authorized, ordered evidence. API use cases coordinate
  reads and calculations. The TypeScript engine package owns loading, boundary
  contracts and typed failures. Persistence never imports the engine or API.
- Public core/SDK contracts stay independent of WASM. Rust is the sole production
  owner of migrated algorithms; do not add a TypeScript fallback.

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
- Preserve evidence semantics: input ordering, first-seen output order, nullable
  observations and legacy numeric behavior. Hash iteration is not output order.
  Completed is not verified business success; missing telemetry proves no liveness.

## Boundary and verification

- Keep Serde DTOs outside domain models. Version the private wire envelope and
  validate decoded output in TypeScript. Numeric precision, nulls, enum spelling
  and ordering are explicit interoperability decisions.
- Use the pinned toolchain and locked Cargo dependencies; keep the wasm-bindgen
  library and CLI versions aligned. Generated bindings/WASM are build outputs.
- Add shared fixtures for preserved behavior and native property tests for actual
  invariants. Do not assume order independence for an ordered evidence stream.
- Run `pnpm rust:check`, engine boundary tests and affected API/integration checks.
  For loader/build changes, run `pnpm evidence:verify-build` to prove the production
  server artifact contains and executes the module. Compilation alone is insufficient.
- Add future calculations only with a concrete caller, explicit contract and
  ownership. Leave SQL aggregation/filtering in PostgreSQL unless its complete
  responsibility is deliberately migrated; avoid divergent drilldown rules.
