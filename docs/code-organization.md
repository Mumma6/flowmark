# Effect and module organization

This is the coding standard for new and deliberately refactored Flowmark code.
It supplements [architecture](./architecture.md), the package skills and ADRs;
it does not describe all existing code as already conforming. Preserve Product
1.0's shared evidence and workflow/run semantics throughout restructuring.

## Ownership before mechanics

Domain rules and shared wire schemas belong in `@flowmarkdev/core` when multiple
layers actually consume them. API use cases own authorization and application
policy; API ports describe needed capabilities. DB stores, queries, SQL and
transactions own persistence. Auth owns provider integration and signed identity.
MCP and server routes translate protocols and compose API capabilities. Studio
owns interaction and presentation. Shared UI owns reusable accessible controls.

A shared domain type must not originate in a component or query implementation.
Infer a type from its schema when runtime decoding and the domain shape have the
same owner. Keep application read models API-owned and storage row types DB-owned.
Use explicit mapping or checked compatibility contracts between them. Do not
re-export DB implementation types as API ports, or move every DTO into core.

## Pure functions and services

Keep deterministic transformations synchronous. Compose with Effect collection
modules, `pipe`/`flow`, `Option`, `Result` and `Match`; use immutable grouping and
folds instead of mutating accumulation. An `Array.forEach` callback that updates
a Map or pushes results is still imperative accumulation. Prefer exhaustive
matching for closed variants; simple narrowing guards and ordinary JSX branching
remain useful. Avoid `Effect.gen` around a calculation that needs no effects.

Group related pure utilities in a domain-named module, with named exports. A
module can provide excellent discoverability without a runtime service. Add a
`Context.Service` when related operations share an actual dependency, resource,
configuration or application responsibility that callers need to replace. For
example, authenticated consent submission or email delivery is a capability;
label formatting and URL query construction are pure functions. Do not create
an umbrella Utils service or a service/layer per helper.

Use `Context.Service` and explicit `Layer.effect`/`Layer.succeed` with the pinned
Effect version. Name operations with `Effect.fn`. Resolve dependencies with
`yield*`; compose live implementations at a documented root. Carry requirements
in `R` until that boundary. Separate interface and adapter files when multiple
implementations, imports or independent testing justify it; a small cohesive
service and its layer may live together. No mandatory five-file service template.

Ordinary classes and mutable domain objects are not the default. Context service
tags and `Data.TaggedError` classes are intentional Effect constructs. Existing
public Error/adapter classes retain their compatibility contract; changing them
is a design decision, not routine cleanup. Native platform/framework callback
objects may require private mutation; document its owner and lifetime.

## Errors, validation and lifetimes

Decode unknown input with Schema at HTTP, environment, storage, form or external
SDK boundaries. Preserve invalid-versus-absent selections and accepted coercions.
Do not repeatedly decode already trusted values or use unsafe casts to bypass a
boundary. Bounded unknown-input traversal must check depth before structural
hashing or equality. A short immutable ancestor path with reference identity
keeps cycle detection separate from structural equality and permits shared
references. Optional/null wire fields stay compatible; Option is for internal
absence and Result for synchronous failures. Public branding/readonly changes
need compatibility review rather than a global type rewrite.

Keep expected failures tagged and preserve safe operation/cause context. Recover
by tag and apply an explicit owner policy. Empty collections, null or unavailable
views are valid only when they represent the specified outcome, never a failed
read disguised as successful data. Fallback plaintext highlighting and an
unavailable optional capability probe are examples of presentation policies;
keep them distinguishable from successful highlighted content or enabled access.

Use Scope/acquireRelease for owned resources, and structured fibers for child
work. Use Ref/SynchronizedRef for Effect-owned state and effectful serialization;
keep React state in React. Bound independent concurrency explicitly. Authorization
precedes data reads; dependent writes and per-run telemetry retain their order.
Never move request identity into a global service or cached Ref.

Run Effects at process/request, public SDK, foreign callback or named browser
operation boundaries. Drizzle and Better Auth callbacks are legitimate Promise
boundaries: preserve interruption, context, typed failures and transaction cleanup
when bridging. Merely calling `runPromise` inside `tryPromise` does not prove those
properties. Test success, typed failure, defect, interruption and cleanup for
resource-owning changes. Do not replace the existing transaction system casually.

## Cohesive feature modules

Choose folders by behavior and change ownership, then introduce a technical
subdirectory only where it improves navigation. Keep small features flat. Split
when independent concerns have independent callers/tests, not at a line threshold.
Do not produce one-file folders or barrel forests just for symmetry. Kebab-case
files name domain behavior; tests stay under package/app `test/`, mirroring the
feature structure when useful. Avoid creating re-export shims for private file
moves; update imports together. Preserve published package entry points.

API retains `features/<domain>/{use-cases,ports,adapters}`. Add domain/model/schema
modules within the relevant feature as needed. Persistence retains stores with
`queries/`, `writes/` and `sql/`; it is not a second ports/adapters tree. SDK
retains direct `workflows/` and `delivery/` domains and its client runtime root.
Configuration-only packages and Pulumi programs do not need Effect services.

Local runtime imports should form an acyclic graph. Type-only imports may break
runtime cycles, but shared types should still live with their owner rather than
pointing back from a mapper to the use case that calls it. Boundary checks must
distinguish type-only and runtime edges and follow re-exports/dynamic imports;
regex counts alone are not proof of dependency safety.

## Studio target structure

Studio remains `apps/dashboard`. `app/` contains route/layout/metadata and proxy
entries; views/controllers/models remain under `features/`. Within a feature,
introduce a cohesive subfeature containing its small components, controller hooks
and pure model modules. Do not mandate identical folders for every feature.
The refactored run, connection, result and onboarding features follow this organization:

```text
features/
  runs/
    explorer/
      run-explorer.tsx            # composition and rendering
      filters/                   # focused business/execution/result/technical views
      use-run-explorer.ts         # React Query + local state controller
      explorer-filters.ts         # pure filter/query rules
    investigation/
      run-investigation.tsx       # evidence workspace composition
      use-run-investigation.ts   # route/React interaction state
      investigation-model.ts     # pure projections
      investigation-selection.ts # validated selection rules
    timeline/
      run-event-timeline.tsx
      run-waterfall.tsx
      timeline-presentation.ts
    handoff/
      run-handoff.tsx
      use-run-handoff-copy-state.ts
      safe-run-context-handoff.ts # pure redaction/export policy
    queries.ts                   # existing shared query hooks until a real split
    models/run-state.ts          # shared historical terminal rule
  connect/
    access/                      # capability + real verification state
    consent/                     # consent operation/controller/view
    connections/                 # list + revoke/confirm operation/controller/view
    setup/                       # instructions and setup interaction
  results/
    declarations/                # form model/controller/editor
    outcomes/                    # query/controller/model/presentation
  onboarding/
    getting-started/              # checklist, guide and prompt cards
    step-views/                  # project/key/install/instrument/run presentation
  reporting/
    charts/                      # one cohesive chart per component
    chart-model.ts               # immutable projections and formatting
  platform/                      # config, typed transport, providers, server runtime
  shared/                        # actual cross-feature presentation, not domain rules
```

Keep a single query implementation and cache owner for each capability. Views
render loading/error/empty/data states; controllers compose hooks and operations;
`.ts` models own parsing, filtering, classifications and derived data. TSX may
handle UI events and state, but should not build live adapters or define reusable
application operations in click handlers. Move related operations together into
a service only when they share a real dependency; React Query remains the data
cache/retry/polling/cancellation owner. No second scheduler or global runtime.

Cross-feature imports target the owning feature's deliberate contract/model;
shared run rules stay with runs. Do not move them into global `lib/utils`.
Prefer explicit imports; introduce a feature entry module when it actually bounds
multiple consumers, keeping server-only modules out of client barrels.

Split components around independently meaningful controls/panels, retaining
semantic HTML and focus ownership. Use `@flowmark/ui` primitives and shared tokens.
Preserve history/back, project switches, keyboard interaction, error feedback,
responsive layout, evidence bounds and polling. Folder moves alone do not justify
changing UI or making network data look synchronous.

## Verification and compatibility

Use focused characterization tests for rules before moving them. Test actual
contracts and lifecycle behavior; avoid snapshots that only restate file layout.
Add import-boundary tests for dependency direction and runtime cycles, separate
from behavioral tests. Run the affected workspace's tests, lint and typecheck;
check downstream consumers when exports/imports change. Build the affected app
when composition or framework modules move; inspect changed interactions in the
browser. A pure module move with no UI change does not need fabricated visual
verification.

Keep ordinary Promise SDK methods, browser/server export separation, wire/error
contracts, SQL meanings and migration history. Reuse the existing browser cost
benchmark owner before adding runtime dependencies. Do not impose Effect on
consumer examples or wrap Pulumi's own resource graph in another runtime.

Effect API details follow the installed 4.1.0 source/ai-docs, checked alongside
[official service migration](https://github.com/Effect-TS/effect/blob/main/migration/services.md)
and [layer documentation](https://effect.website/docs/v4/requirements-management/layers).
Those evolving pages are references; the repository's installed API is the
implementation authority.

## Foreign runtimes and optional presentation

`runTransaction` is the single Drizzle callback bridge. It preserves the child
Effect context and Cause, propagates interruption into the connection, and joins
rollback/finalizers before returning. A connection has one cancellation owner;
never reuse it after cancellation. SQL callbacks do not create detached fibers.

MCP resolves live delegated authority and admission budgets through API services.
The API adapter owns persistence; protocol modules must not import DB stores.
Workflow read contracts group runs, analytics and discovery capabilities while
retaining one aggregate service and compatible package exports.

SDK `reads/read-request.ts` constructs the lazy operation, `read-response.ts`
owns the bounded reader, and `transport.ts` executes at the ordinary Promise
boundary. Endpoint validation is a synchronous Result. Capture fetch/key per
client and status per request, with no global runtime or browser server imports.

Shared UI uses disposable Promise subscriptions where React/browser callbacks
own the lifetime. Highlighting may fall back to plaintext; diagram replacement
hides obsolete SVG/failure immediately. `@flowmark/ui/mermaid` is a separate lazy
docs entry, never exported from the UI root or the portable evidence view.
Mermaid remains strict and dynamically loaded. Shared UI does not acquire Effect
merely for architectural symmetry.

Demo generation composes pure configuration, day context, referral, patient
journey, notification and integration builders. Preserve keyed draws and complete
canonical dataset fixtures when changing composition; never seed a hosted target
to verify a refactor.
