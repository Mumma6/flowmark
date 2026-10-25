---
name: flowmark-architecture
description: "Use when adding or refactoring Flowmark SDK, API, core, or persistence code; apply Effect-first functional programming, ports and adapters, typed errors, and the repository's file organization."
---

# Flowmark Architecture

Apply this skill when implementing or refactoring Flowmark's internal SDK, API,
core, or persistence architecture.

## Architectural goals

- Use Effect as the default internal model for asynchronous and dependencyful
  workflows. Keep effects lazy and compose them before executing them at
  process, request, or public SDK boundaries.
- Use functional programming: pure functions and immutable data by default;
  avoid mutable domain objects, class hierarchies, service locators, and
  unnecessary object-oriented abstractions.
- Use feature-first ports and adapters so application behavior depends on
  small contracts, not on frameworks, network clients, or database libraries.
- Preserve an ergonomic public TypeScript API. The SDK may expose ordinary
  methods and Promises while keeping Effect execution inside its boundary.
- Keep the architecture deliberately small. A port or service is useful when it
  marks a real dependency or use case, not merely to make another file.

## Dependency direction

```text
apps/server (Next.js / tRPC / HTTP) ──> @flowmark/api use cases ──> ports
                                         │                         ▲
                                         └── persistence adapters ─┘
```

- `core/` owns domain types, pure rules, and Effect Schema definitions. It must
  not depend on SDK, API, framework, or persistence implementations.
- Use cases compose application behavior with `Effect.gen` and named
  `Effect.fn` functions. They depend on port tags and domain contracts.
- `ports/` defines narrow service interfaces and their Effect `Context.Tag`s.
  Port contracts must not import types from the adapter they abstract.
- `adapters/` implements ports and translates framework, network, and storage
  details into application-level values and tagged errors.
- Framework route files should be thin: delegate to an HTTP/tRPC/framework
  adapter, which decodes protocol input and maps application outcomes to
  protocol responses.
- Composition roots construct `Layer`s and are the only place that should know
  which live adapters satisfy the ports.
- Put API application behavior in `packages/api` (`@flowmark/api`), not in the
  current server app. The API package owns use cases, ports, tagged errors,
  persistence adapters, and default Effect layer composition; it must not
  depend on Next.js, tRPC, or another HTTP framework.
- Keep `apps/server` as the current Next.js deployment and protocol shell:
  route handlers, HTTP decoding/response mapping, CORS, and tRPC orchestration
  belong there. Other server/framework apps should be able to depend on
  `@flowmark/api` and compose the same use cases without importing this app.
- Dashboard code that needs the tRPC router type imports it from
  `@flowmark/server/trpc`, not from `@flowmark/api`.
- When adding an endpoint, keep the framework request/response adapter in the
  relevant app and call an API use case for application behavior. Do not add
  authorization, ingestion, query, or persistence rules to route handlers or
  tRPC procedures.
- When adding a server framework, create a separate app adapter that depends
  on `@flowmark/api`; do not move or copy the feature use cases. Decode the new
  framework's input, call the same service tags, and map typed failures at
  that framework's boundary. Use the default `runApi`/`ApiLive` composition
  when the existing persistence adapters are appropriate; otherwise compose
  the exported use-case layers with implementations of the API ports.

## Effect and failure handling

- Write effectful logic as `Effect.Effect<A, E, R>`; do not implement a Promise
  workflow and wrap it in `Effect.tryPromise` afterward.
- Use `Effect.tryPromise` only at genuine Promise-based library boundaries,
  translating failures to tagged errors that preserve useful operation context
  and the original cause.
- Validate untrusted input with Effect Schema at the boundary. Keep expected
  failures explicit in the error channel.
- Keep injected services as plain interfaces registered with `Context.Tag`;
  provide implementations with `Layer`. Use scoped resources for acquired
  clients, connections, fibers, and request lifetimes.
- Do not execute Effects inside internal helpers. Execute them at an explicit
  application, request, process, or public SDK boundary.
- Do not suppress errors or return success-shaped fallbacks. Map failures to
  HTTP/tRPC responses only at the protocol boundary and retain diagnostic
  causes.
- Do not introduce Effect wrappers for pure transformations or plain data.

## File and folder organization

Prefer small, specific files grouped by architectural responsibility. Follow
existing package conventions; adapt these examples rather than creating empty
layers:

```text
src/
  features/
    workflows/
      use-cases/
      ports/
      adapters/
      rules/    # only when pure feature rules are needed
      types.ts  # only when feature-owned types are shared
    project-access/
      use-cases/
      ports/
      adapters/
  adapters/     # inbound framework/protocol boundaries when shared
  runtime.ts    # live Layer composition and execution boundary
test/
  features/     # grouped by feature when the suite grows
  adapters/     # adapter contract and integration tests
```

- Group feature-owned use cases, ports, rules, types, and repository adapters
  under the feature that owns them. Do not group the entire application only
  into global `use-cases/`, `ports/`, and `adapters/` trees.
- Name files for domain behavior in kebab-case, for example
  `get-workflow-runs.ts`, `workflow-repository.ts`, and
  `project-credentials.ts`.
- Avoid vendor names such as `postgres` in application feature paths and
  filenames. Keep vendor-specific details inside the persistence adapter/package
  that owns them; use an implementation-specific name only when several
  implementations must coexist.
- Keep tests out of `src/`; place them under a package-level `test/` tree and
  group them by use case or adapter when that improves discovery.
- In `packages/sdk/src`, keep only the public `index.ts` at the source root.
  Put SDK domain behavior under feature folders, with each feature's own
  `use-cases/`, `ports/`, `adapters/`, `rules/`, and `types.ts` only when they
  are useful. Keep genuinely shared entry points and concerns in folders such
  as `client/`, `config/`, `types/`, `errors/`, and `utils/`; keep framework
  integrations shared only when they do not belong to one feature.
- Prefer one primary service, port, adapter, or use case per source file.
- Keep route entry files where their framework requires them; put reusable
  protocol logic in the corresponding adapter.
- Preserve package entry points and public exports when moving internal files.
- Do not create a generic abstraction solely to anticipate a hypothetical
  replacement. Create seams around dependencies that already exist and are
  likely to vary.

## SDK-specific rules

- The SDK observes application work; it does not own or execute that work.
- Keep the ordinary public TypeScript/Promise surface at the SDK boundary and
  the transport, sequencing, validation, concurrency, and resource management
  in composable Effect services.
- Keep network destinations behind a transport port. HTTP, memory, browser,
  proxy, and framework lifecycle integrations are adapters.
- Do not allow instrumentation failures to unexpectedly alter application
  business behavior; expose delivery failures through the documented
  diagnostics and explicit flush/shutdown boundaries.
- Preserve browser/server credential separation and treat browser telemetry as
  untrusted.

## API and persistence rules

- Use cases depend on API-owned port contracts, not Drizzle query results or
  database-specific error classes.
- Database adapters translate driver failures to typed application errors and
  return application-owned read models.
- Keep authorization/project scoping in use cases and enforce project scoping
  in every persistence query.
- Keep SQL, schema mappings, transactions, and driver lifecycle inside the
  persistence package or its concrete adapter.
- Treat tRPC as an adapter, not as the application service layer. The use cases
  should remain callable without tRPC or Next.js.

## Verification checklist

1. Read neighboring files and reuse the established Effect and naming patterns.
2. Test use cases through injected service implementations without real
   framework/network/database dependencies.
3. Test adapter translations and resource cleanup at their boundaries.
4. Verify success, typed failure, interruption, and cleanup behavior where
   applicable.
5. Run the narrow package tests, typecheck, and lint; verify public exports
   after moving files.
