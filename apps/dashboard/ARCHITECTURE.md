# Dashboard architecture

The dashboard presents application-reported workflow telemetry. It does not
execute or retry application work. Technical completion, reported business
results and missing terminal evidence remain separate concepts.

## Responsibilities and dependency direction

- `app/` owns Next route entries, layouts, metadata, global theme CSS and the
  three existing same-origin proxy routes. Pages compose feature views.
- `features/overview`, `workflows`, `runs`, `insights`, `issues`, `expectations`,
  `results`, `projects`, `settings`, `onboarding` and `search` own their views,
  query/controller hooks and domain-specific projections. `features/auth` owns
  the browser authentication operations and screen. `features/period` owns
  the shared UTC period selection and evidence-navigation rules.
- `components/` owns dashboard presentation primitives and application
  providers. `components/layout` composes navigation, search, projects and
  theme. `components/reporting` contains charts/panels shared by several
  features. Reusable controls still come from `@flowmark/ui`.
- `lib/api` owns tRPC context, client construction, inferred API input/output
  types, the upstream server client and proxy adapter. `lib/auth` contains
  Better Auth adapters and server session/access reads.
- `lib/config` separates server-only and browser-safe configuration.
  `lib/telemetry` contains shared pure run/event projections; `lib/reporting`
  contains snapshot statistics. Formatting and collection pagination/grouping
  have small, explicit modules.
- `test/` contains unit, characterization and architecture-boundary tests.

Views call feature hooks and render their state. Hooks compose typed tRPC query
options or application operations; pure `.ts` models own rules and transformations.
Transport adapters do not import views. Shared telemetry models use type-only
API imports, never component-owned event types. Composition roots intentionally
know which feature/service implementations they wire. There are no local
module-import cycles.

## Effect and execution boundaries

`DashboardServerConfig.layer` validates API configuration when an execution
acquires it. `DashboardApi.layer` depends on that service and implements one
upstream request boundary with tagged transport errors, timeout/cancellation,
`no-store`, manual redirects and server-only protection headers. A layer is a
description, not a global client carrying request identity.

`lib/server-runtime.ts` composes these layers and executes server effects.
React's `cache` deduplicates session/access work within a server render, never
across users. Session and onboarding reads decode unknown JSON with Effect
Schema. Anonymous, 401/403 and null-session results remain explicit `Option`s;
configuration, invalid JSON, unexpected status and transport failures remain
errors. Cookies are read inside the request, not stored in shared services.

`BrowserAuth` is the dependency contract for registration, sign-in, sign-out,
name updates and password changes. The Better Auth/fetch adapter is provided
at `lib/auth/browser-runtime.ts`. Application operations remain lazy Effects
until a React event calls `runBrowserAuth`, receiving a typed `Result` for UI
feedback. Registration must succeed before sign-in. Failed sign-out does not
navigate as though it succeeded. React rendering and component state do not run
inside Effect.

Pure rules also use Effect's `Option`, `Result`, `Match`, `Array`, `Order` and
pipes: immutable result revision/path selection, workflow namespace/order,
terminal-event interpretation, optional duration differences and URL filter
parsing. Missing values, zero, false, explicit null, invalid selections and
historical failure precedence retain their distinct meanings. Pure functions
stay synchronous; they do not acquire services or execute an Effect runtime.

## Data access, cache and mutations

The browser keeps the existing same-origin tRPC + React Query integration and
router-derived types. There is no second HTTP data pipeline and no new proxy
route. Query hooks/controllers are colocated with their feature. Shared result
and project-key queries use the same tRPC keys as before. The default interval
is three seconds with one read retry; expectations retain ten-second polling;
command search retains debounce, no polling/window refetch and no retry.

Project choice remains in local storage, contributes the project header and
clears project-sensitive queries when switched. Existing server authorization
continues to enforce membership. Run history retains cursor pagination (25
rows), server-side filters, route workflow precedence, exact business references,
result/ratio selections and inclusive/exclusive evidence bounds. Invalid result
selections remain invalid API inputs; they never silently broaden a query.

Mutations keep their existing invalidation behavior. Key rotation remains
non-retrying, confirms the chosen key and shows the replacement once. Secret
state clears on project/account changes. Registration/session JSON is decoded
at the untyped HTTP boundary; tRPC data continues to use the shared server
router contract rather than duplicating the backend schemas in the dashboard.

## Configuration ownership

`lib/config/server.ts` is marked `server-only`. It owns API origin resolution,
Preview sibling selection, production requirements, demo-mode guards, protection
bypass configuration and the existing local-account display gate. Existing
`@flowmark/db/environment` safety checks remain authoritative for hosted
isolation. `NODE_ENV=production` alone never selects the SDK installation target.

`lib/config/public.ts` owns same-origin auth/register/tRPC paths, public
polling defaults and the existing `NEXT_PUBLIC_FLOWMARK_DOCS_URL` override.
The documentation URL is validated as credential-free HTTP(S), with the same
development/hosted defaults. Invalid configured values fail explicitly.
Next inlines public env values at build time; this is not a runtime secret
configuration channel.

The authenticated shell/onboarding passes only the validated API URL through
`RuntimeConfigProvider` for installation help. This fixes the previous behavior
where Preview builds generated SDK instructions pointing at Production. No
bypass credential, cookie, server key or auth factory crosses that boundary.
No new environment variable or hosted binding was introduced.

## Refactoring evidence and verification

Before restructuring: 15 test files, 71 passing tests. Characterization tests
covered run results, historical failure precedence, timeline/progress, export,
UTC periods, server config, session and proxy safety. New tests cover extracted
run filters/cohort links, workflow ordering, investigation models, auth sequencing,
request isolation, public config and transitive client import boundaries.

The Tailwind scanner and lint command include the new source directories.
An AST comparison of all JSX `className` attributes against the original tree
found no removed or changed attribute; only sign-out failure feedback was added.
This supports layout preservation but does not substitute for browser inspection.

Verified locally on November 2, 2026:

- Dashboard: 23 test files / 103 tests passed; lint and TypeScript passed.
- `pnpm test:integration`: 57 database tests and 103 server tests passed against
  its own disposable Compose PostgreSQL; the runner removed its containers and
  network without deleting volumes. The existing checkout database was not
  migrated, seeded, reset or stopped.
- `pnpm --filter @flowmark/dashboard exec next build --webpack`: production
  compilation, Next TypeScript, static generation and trace collection passed.
  The route list is unchanged. The default Turbopack build was attempted twice
  (including normal approval escalation) and remained blocked by the host's
  prohibition on binding a local port in its CSS worker. This is a verification
  limitation; the normal build script remains unchanged.
- Formatting, whitespace, module graph and feature-dependency graph checks passed.
- Browser inspection used the production dashboard on loopback, the local API
  started through `pnpm dev` with other apps excluded, and existing fixture
  telemetry. Verified Overview, Workflows, workflow detail, Runs, run detail,
  Insights and Issues, all four Settings tabs, command search, server-side
  filtering/clear, empty filtered results, 7/30-day period switching, sign-out
  and a fresh sign-in using the existing local account.
- Run investigation: Outcome, Timeline, Operations waterfall, event table,
  Context, Compare and Related runs rendered. Loading indicators, empty
  expectation/link populations and the small-peer-sample warning were observed.
- Mobile inspection at 390 × 844 verified Runs' semantic list, Overview and the
  navigation sheet; document width stayed within the viewport. Desktop and
  mobile screenshots were retained locally and are not included in this change.
  No browser console warning/error appeared during the normal journeys.
- A deliberate stop of this chat's own API produced explicit data errors and
  retry buttons; data returned through the existing polling after restarting it.
  All app/watch processes started by this chat were then stopped. The existing
  healthy Compose container was left running.

The normal local auth origin is `http://localhost:3001`; attempts from
`http://127.0.0.1:3001` correctly returned `Invalid origin`. No trusted-origin
setting was changed. Fresh-account onboarding, browser key mutations, large-data
cursor navigation and hosted environments were not browser-tested. Disposable
integration tests cover auth/project/key mutations and project isolation.
No claim of pixel-perfect regression coverage is made from these checks.

## Scope and follow-ups

No backend API contract, schema, provider configuration, shared package or
package dependency changed. No hosted migration, deployment, publication,
push or merge is part of this refactoring. The current client-owned project
selection and polling intentionally remain; moving telemetry reads to RSC would
require a separate cache/project-selection design. Exhaustive visual snapshots
and real hosted Preview/Staging journeys remain separate from local checks.

Observed existing follow-up: when the proxy returns a non-tRPC 502 response,
React Query displays the explicit failure state but its detail reads
`Unable to transform response from server`. Improving that transport-specific
message is separate from this behavior-preserving refactor.
