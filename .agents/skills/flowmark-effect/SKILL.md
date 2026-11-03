---
name: flowmark-effect
description: >-
  Flowmark TypeScript code conventions: use modern Effect as much as possible
  (Effect.fn, pipe, Match, Result.match, catchTag/catchTags, Layers, Scope,
  Context.Service). Use when writing or refactoring TypeScript, Effect, API,
  db, CLI, server, SDK, ordinary pure TypeScript, or other internal Flowmark code.
---

# Flowmark Effect conventions

Use Effect for almost all internal work: I/O, validation, errors, resources,
and dependency wiring. Prefer the installed Effect 4 APIs below, not ad-hoc
`async`/`await`, `try`/`catch`, `.then()`, or hand-rolled result types.

Architecture and package boundaries stay in
[flowmark-architecture](../flowmark-architecture/SKILL.md). Persistence folder
rules stay in [flowmark-persistence](../flowmark-persistence/SKILL.md). This
skill is how to write the Effect itself.

Keep the public SDK as ordinary TypeScript/Promises. Execute Effects only at
an explicit process, request, CLI, or public SDK boundary.

## Pure TypeScript is Effect-first too

Apply these conventions to models, projections, formatting, filtering, URL
selection, validation and tests, not only I/O. Before implementing a familiar
TypeScript idiom, look for the installed Effect module that owns that operation.
Use the library's data types and operators directly; do not create a local
replacement or a compatibility wrapper for an API that already exists.

- Do not write ordinary `for`, `for...of`, `for...in`, `while` or `do...while`
  loops. Use Effect `Array`, `Record`, `Iterable`, `HashMap` and related collection
  operators for pure iteration. Prefer `map`, `filter`, `reduce`, `mapAccum`,
  `zip`/`zipWith`, `unfold` and grouping over mutable accumulation. Use
  `Array.forEach` for synchronous side effects that actually need iteration.
- Use `Effect.forEach`, `Effect.reduce` or `Effect.whileLoop`
  for effectful iteration. Preserve order explicitly; bound concurrency for
  independent work and keep dependent writes sequential. Do not conceal an
  asynchronous loop in an unawaited collection callback.
- Use `Option` for absent values and `Result` for synchronous fallible work.
  Effect 4 uses `Result`, not the old `Either` API. Keep operation/cause in tagged
  failures. Do not throw away an error as `None` or an empty collection unless
  the caller explicitly owns that presentation/recovery policy.
- Match variants and conditions with `Match`, `Option.match`, `Result.match`
  and typed catch operators instead of switch statements, nested ternaries or
  chains of `if`/`else`. Prefer exhaustive matching for a closed vocabulary.
  A short boundary guard may remain when it is clearer and preserves narrowing.
- Define reusable trust-boundary shapes with `Schema` and infer their types.
  Decode unknown HTTP, environment, URL, storage and form data at its owning
  boundary. Preserve accepted inputs, coercions and explicit invalid selections;
  failed decoding must not silently widen a query or become a success fallback.
- Use `Ref` for mutable state owned by an Effect workflow and `SynchronizedRef`
  when updates require effectful serialization. Allocate it in the owning
  request/run/client scope; never share request identity through a global Ref.
  Keep React UI state in React. Pure transformations need no mutable service.
- Compose independent effects with `Effect.all`, `zip`/`zipWith` or bounded
  `forEach`; use Scope/finalizers for resources and fibers. Do not add a second
  scheduler around an existing React Query cache or parallelize authorization
  dependencies, ordered telemetry or irreversible writes.
- Check installed source/declarations and ai-docs for the actual version before
  selecting an API. In Effect 4 `Array.filterMap` consumes Result-returning
  filters; use `Array.map` plus `Array.getSomes` for Option-returning projections.
  Survey the relevant collection, schema, state, concurrency and resource APIs
  rather than stopping at Effect.fn and tryPromise. Do not copy a full API
  catalog into project instructions.

Keep pure operations synchronous and compose with `pipe`/`flow`. These rules
require Effect's pure modules, not an Effect runtime for every calculation.
Normal JSX composition and React state remain React concerns.

## Default shape

Pulumi resource declarations in `infrastructure/` use the Pulumi runtime and
[infra workflow](../flowmark-infrastructure/SKILL.md), not application Effect
execution. This exception does not permit direct provider mutation from scripts.

- Type workflows as `Effect.Effect<A, E, R>`. Keep them lazy. Compose first,
  run last.
- Name effectful functions with `Effect.fn("Feature.operation")`.
- Prefer `function*` + `yield*` for sequential work. Use `.pipe(...)` for
  transformation, error handling, and layer wiring.
- Inject dependencies with `Context.Service`. Provide them
  with `Layer`. Do not construct live clients inside use cases.
- Put failures in the error channel as tagged errors (`Data.TaggedError`).
  Never swallow them or convert them into a success-shaped fallback.

```ts
export const authorizeUser = Effect.fn("AuthorizeProject.authorizeUser")(
  function* (userId: string) {
    const projectId = yield* credentials.projectForUser(userId)
    if (!projectId) {
      return yield* new Unauthorized({ permission: "read" })
    }
    return projectId
  },
)
```

## Pattern matching

Use Effect's matchers instead of nested `if`, `switch`, or `result._tag ===`.

| Value                | Use                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| Tagged error / union | `Match.value(error).pipe(Match.tag(...), Match.orElse(...))`                                       |
| `Result`             | `Result.match({ onFailure, onSuccess })`                                                           |
| `Exit`               | `Exit.match({ onSuccess, onFailure })`                                                             |
| `Option`             | `Option.match({ onNone, onSome })`                                                                 |
| Cause                | Inspect `cause.reasons` with `Cause.isFailReason` / `Cause.isDieReason`; match individual reasons. |

Prefer `Match.exhaustive` when every member of a closed union must be handled.

```ts
return Exit.match(result, {
  onSuccess: (value) => value,
  onFailure: (cause) =>
    cause.reasons.length === 1
      ? Match.value(cause.reasons[0]).pipe(
          Match.tag("Fail", ({ error }) => mapProtocolError(error)),
          Match.orElse(internalError),
        )
      : internalError(),
})
```

```ts
Effect.result(operation).pipe(
  Effect.map(
    Result.match({
      onFailure: (error) => formatError(error),
      onSuccess: (value) => formatSuccess(value),
    }),
  ),
)
```

## Errors

- Catch by tag, not by message or `instanceof` on raw `Error` when a tagged
  error already exists: `Effect.catchTag`, `Effect.catchTags`.
- Recover only when the caller truly has a policy. Otherwise let `E` propagate.
- At a Promise library boundary, use `Effect.tryPromise` / `Effect.try` and
  map immediately to a tagged error that keeps `operation` and `cause`.
- Do not write a complete `async` function and wrap the finished Promise
  afterward.

```ts
operation.pipe(
  Effect.catchTag("Unauthorized", () =>
    Effect.fail(new TRPCError({ code: "UNAUTHORIZED" })),
  ),
  Effect.catchTags({
    RunNotFound: (error) => Effect.succeed(missingRun(error.runId)),
  }),
)
```

## Layers, services, and scope

- Compose live graphs with `Layer.succeed`, `Layer.effect`,
  `Layer.mergeAll`, `Layer.provide`, and `Layer.provideMerge`.
- Acquire connections, clients, and other resources with
  `Effect.acquireRelease` inside `Effect.scoped` or a scoped layer. Release
  on success, failure, and interruption.
- Use `Context.Service<Self, Shape>()("id")` for explicit interfaces, or
  `Context.Service<Self>()("id", { make })` for inferred implementations.
  Define `static readonly layer = Layer.effect(this, this.make)` explicitly.
  `Effect.Service`, `Context.Tag`, generated accessors and `.Default` are v3 APIs.
  Resolve services with `yield*`; use `Service.use` only for concise local access.
- `Layer.effect` supplies the acquisition Scope, including finalizers. There is
  no `Layer.scoped` in v4. Keep `acquireRelease` cleanup in the owning scope.
- Compose layers before providing them. Nested `Effect.provide` calls reuse
  enclosing layers in v4; use `{ local: true }` or `Layer.fresh` only when a
  separate lifetime is actually required.
- Do not hide `R` by running an Effect halfway through a helper. Provide
  layers at the composition root (`runtime.ts`, CLI runner, test `Layer`).

```ts
const persistence = Layer.mergeAll(
  WorkflowStore.layer,
  ProjectCredentialsStore.layer,
).pipe(Layer.provide(DatabaseLive))
```

```ts
Effect.scoped(
  Effect.gen(function* () {
    const connection = yield* Effect.acquireRelease(
      Effect.try({
        try: () => createDatabase(url),
        catch: (cause) => new DatabaseError({ operation: Connect, cause }),
      }),
      ({ close }) =>
        Effect.tryPromise({
          try: close,
          catch: (cause) => new DatabaseError({ operation: Close, cause }),
        }).pipe(Effect.orDie),
    )
    return yield* use(connection.db)
  }),
)
```

## Pipes over nested calls

Write data-last pipelines. Do not nest `fn(fn(fn(x)))` when `.pipe` is
clearer.

```ts
snapshot(header).pipe(
  Effect.map((data) => data.workflows),
  Effect.catchTag("Unauthorized", () => Effect.succeed([])),
)
```

Use `flow` only for reusable pure pipelines. Keep one-off composition on the
value with `.pipe`.

## Installed APIs and migration-sensitive boundaries

Flowmark pins Effect 4 exactly because its HTTP and Schema APIs include unstable
surfaces. Inspect the installed `effect/src`, `effect/dist` declarations and
`effect/ai-docs` when an API is uncertain; check official migration notes for
behavior changes instead of recreating v3 compatibility helpers.

- `Result` replaces `Either`: use `Effect.result`, `Result.match`,
  `onFailure` / `onSuccess` and `.failure` / `.success`.
- Typed recovery is `Effect.catch`, `catchTag` or `catchTags`; full-cause
  recovery is `Effect.catchCause`. A Cause is a flat `reasons` array. Preserve
  mixed defects and finalizer failures; never pretend they are one typed failure.
- Import HTTP clients from `effect/http`. HTTP failures are `HttpClientError`
  wrappers whose `reason` describes the failure; use `cause.response?.status`.
  Capture replaceable fetch implementations explicitly at client boundaries;
  v4 `Context.Reference` defaults are cached, including FetchHttpClient.Fetch.
- Use `Semaphore.make` instead of `Effect.makeSemaphore`. Keep per-run event
  ordering and client-owned delivery resources intact.

## Validation and schema

- Use `Schema.decodeUnknownEffect` at an Effect boundary,
  `decodeUnknownResult` for synchronous branching, and `toStandardSchemaV1`
  for tRPC. Infer data with `typeof MySchema.Type`.
- Use `.check(...)` or `Schema.check(...)` with `isMinLength`, `isInt`, etc.
  Custom predicates use `Schema.makeFilter`; type refinements use `Schema.refine`.
  `Schema.Union` / `Schema.Literals` take arrays; `Record` takes key/value schemas.
- Preserve validation and wire contracts; a migration that typechecks can still
  change accepted input, optional keys, transforms, or sensitive error output.
- Decode untrusted input with Effect `Schema` at the trust boundary
  (HTTP body, env, CLI args).
- Keep parsed values as branded/struct types. Do not re-validate the same
  payload deeper in a use case unless a new trust boundary appears.
- Missing config is a typed failure (`ConfigurationError` or equivalent),
  not `process.env.X!`.

## What not to do

- `try` / `catch` / `async` / `await` for domain or use-case control flow
- `.then()` / `.catch()` chains
- `result._tag === "Failure"` when `Result.match` or `Match` exists
- `switch (error._tag)` when `catchTags` or `Match.tag` exists
- Mutable service classes, locators, or singleton clients
- `Effect.runPromise` inside helpers, adapters, or React components
- Wrapping a completed Promise workflow in `Effect.succeed` / `tryPromise`
- Empty `catch` that turns failure into `null`, `undefined`, or a fake success
- New error unions as `string` or untyped `Error`

Framework handlers (Next.js routes, tRPC procedures, React event handlers)
may stay `async` at the edge. The work they call should still be an Effect
until that edge.

## Checklist

1. Is the new logic an Effect until an explicit boundary?
2. Are dependencies in `R` via a tag/service and provided by a Layer?
3. Are failures tagged and handled with `catchTag` / `Match` / `Result.match`?
4. Are resources scoped with `acquireRelease`?
5. Is the pipeline written with `Effect.fn` and `.pipe` rather than nested
   Promises?
6. Does pure TS use Effect collections, matching, Option/Result and Schema, with
   no imperative loops or success-shaped decoding fallbacks?
7. Have state ownership, concurrency bounds, ordering and resource scope been
   considered without adding unnecessary mutable dependencies?
