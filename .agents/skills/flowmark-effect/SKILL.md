---
name: flowmark-effect
description: >-
  Flowmark TypeScript code conventions: use modern Effect as much as possible
  (Effect.fn, pipe, Match, Either.match, catchTag/catchTags, Layers, Scope,
  Effect.Service). Use when writing or refactoring TypeScript, Effect, API,
  db, CLI, server, SDK, or other internal Flowmark code.
---

# Flowmark Effect conventions

Use Effect for almost all internal work: I/O, validation, errors, resources,
and dependency wiring. Prefer the current Effect 3 APIs below, not ad-hoc
`async`/`await`, `try`/`catch`, `.then()`, or hand-rolled result types.

Architecture and package boundaries stay in
[flowmark-architecture](../flowmark-architecture/SKILL.md). Persistence folder
rules stay in [flowmark-persistence](../flowmark-persistence/SKILL.md). This
skill is how to write the Effect itself.

Keep the public SDK as ordinary TypeScript/Promises. Execute Effects only at
an explicit process, request, CLI, or public SDK boundary.

## Default shape

- Type workflows as `Effect.Effect<A, E, R>`. Keep them lazy. Compose first,
  run last.
- Name effectful functions with `Effect.fn("Feature.operation")`.
- Prefer `function*` + `yield*` for sequential work. Use `.pipe(...)` for
  transformation, error handling, and layer wiring.
- Inject dependencies with `Context.Tag` or `Effect.Service`. Provide them
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

| Value                | Use                                                                  |
| -------------------- | -------------------------------------------------------------------- |
| Tagged error / union | `Match.value(error).pipe(Match.tag(...), Match.orElse(...))`         |
| `Either`             | `Either.match({ onLeft, onRight })`                                  |
| `Exit`               | `Exit.match({ onSuccess, onFailure })`                               |
| `Option`             | `Option.match({ onNone, onSome })`                                   |
| Cause                | `Match.value(cause).pipe(Match.tag("Fail", ...), Match.orElse(...))` |

Prefer `Match.exhaustive` when every member of a closed union must be handled.

```ts
return Exit.match(result, {
  onSuccess: (value) => value,
  onFailure: (cause) =>
    Match.value(cause).pipe(
      Match.tag("Fail", ({ error }) => mapProtocolError(error)),
      Match.orElse(internalError),
    ),
})
```

```ts
Effect.either(operation).pipe(
  Effect.map(
    Either.match({
      onLeft: (error) => formatError(error),
      onRight: (value) => formatSuccess(value),
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

- Compose live graphs with `Layer.succeed`, `Layer.effect`, `Layer.scoped`,
  `Layer.mergeAll`, `Layer.provide`, and `Layer.provideMerge`.
- Acquire connections, clients, and other resources with
  `Effect.acquireRelease` inside `Effect.scoped` or a scoped layer. Release
  on success, failure, and interruption.
- `Effect.Service` is preferred for persistence stores and other
  accessor-style services. `Context.Tag` + `static layer` is fine for API
  use cases that already follow that pattern.
- Do not hide `R` by running an Effect halfway through a helper. Provide
  layers at the composition root (`runtime.ts`, CLI runner, test `Layer`).

```ts
const persistence = Layer.mergeAll(
  WorkflowStore.Default,
  ProjectCredentialsStore.Default,
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

## Validation and schema

- Decode untrusted input with Effect `Schema` at the trust boundary
  (HTTP body, env, CLI args).
- Keep parsed values as branded/struct types. Do not re-validate the same
  payload deeper in a use case unless a new trust boundary appears.
- Missing config is a typed failure (`ConfigurationError` or equivalent),
  not `process.env.X!`.

## What not to do

- `try` / `catch` / `async` / `await` for domain or use-case control flow
- `.then()` / `.catch()` chains
- `result._tag === "Left"` when `Either.match` or `Match` exists
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
3. Are failures tagged and handled with `catchTag` / `Match` / `Either.match`?
4. Are resources scoped with `acquireRelease`?
5. Is the pipeline written with `Effect.fn` and `.pipe` rather than nested
   Promises?
