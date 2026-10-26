# Architecture

```text
Customer server application
  -> @flowmarkdev/node or @flowmarkdev/node/next
  -> POST /v1/events (private server write key)
  -> project-scoped PostgreSQL records

Browser application
  -> @flowmarkdev/node/browser
  -> POST /v1/browser-events (public browser key + allowed Origin)
  -> project-scoped PostgreSQL records

Dashboard
  -> /api/auth, /api/register, /api/trpc (same-origin proxy)
  -> Better Auth session or project read key
  -> project-scoped API queries
  -> runs, metrics, workflows, timelines
```

The reference API is `https://api.flowmark.dev` and the dashboard is
`https://app.flowmark.dev`. The Neon database behind them, the Vercel
projects, and the environment variables are in the
[infrastructure guide](./infrastructure). The same shape runs locally. The
server application is a replaceable HTTP/framework shell; API use cases,
ports, and persistence adapters live in the separate `@flowmark/api`
package.

## Core domain package

`@flowmarkdev/core` is the framework-independent contract package shared by the
SDK, API, and persistence layers. Its source is grouped into workflow
identifiers, bounded JSON context/results, telemetry types/schemas, failure
schemas, and event/envelope schemas with decoding. The root `index.ts` preserves
the package's public exports.

Core should grow when multiple layers need the same domain rule, value,
transition, or validated contract. It should not become a general-purpose
utility package or collect SDK delivery, authorization, SQL/query, HTTP, or
dashboard behavior. Keep pure domain functions here; use Effect services and
ports in application packages when behavior needs dependencies or orchestration.

## SDK

The delivered public API is ordinary TypeScript: create a client, create a
workflow, record instantaneous `step()` milestones, report non-terminal
`error()` markers, append discovered context with `setProperties()`, measure
independently identified `operation()` units, report absolute `progress()`
snapshots, and complete with `done({ result })` or `fail({ code, result? })`. An
error's required `handled` flag records whether application code recovered; it
does not end the run. Optional `environment` and `release` metadata are
accepted in client configuration or per-run options. `defineConfig()` is a
pure typed identity helper; applications explicitly import its return value
and pass it to `createFlowmark()`. It neither creates a client nor makes
Flowmark discover `flowmark.config.ts`.

Operation terminal events include monotonic elapsed duration and independent
operation IDs, allowing sibling work to overlap without implying nested
parentage. A completion request waits for open operations and completes
automatically when the final operation closes; an explicit workflow failure
supersedes pending completion. The Promise callback overload records operation
failure and rethrows the original application cause without failing the
workflow. Progress values are validated nonnegative absolute snapshots; they
are persisted individually without aggregation or coalescing.

`WorkflowProperties` and `WorkflowResult` are bounded plain JSON-safe records:
maximum depth 5, 128 total keys, 128 characters per key, 2,048 characters per
string, and 16 KiB encoded size. Step properties remain event-local; only
initial and amended run properties make up aggregate context. Raw `Error`
objects and class instances are not accepted as telemetry values.

Effect remains internal to validation and delivery: injectable service/layer,
per-run sequencing, request cancellation, timeout and bounded retries. These
delivery lifecycle mechanisms are not a public workflow cancellation API.
Pure domain structures remain ordinary TypeScript. The Next.js adapter
registers request-scoped delivery with `after()` automatically. Plain Node
applications drain delivery at their process/job boundary.

Runs can be explicitly associated with a bounded `correlationId` or
`parentRunId`; `flow.runId` exposes the current external SDK ID for application-
controlled propagation. The SDK does not inject headers, propagate context,
or create a distributed trace. Related-run queries and parent matches remain
scoped to the authorized project; shared correlation is grouping, not proof of
causation. Browser-supplied links remain untrusted.

The SDK declares its workflow delivery contract as a feature-owned port and
assembles Effect services with layers. The workflow engine lives under
`features/workflows/`; the delivery queue, transport port, and HTTP/memory
implementations live under `features/delivery/`. Browser, proxy, and Next.js
entry points remain separate integration adapters. Public package exports
remain ordinary TypeScript; the runtime is the explicit Effect execution
boundary. The root `src/index.ts` remains the only source-root file, with
client/runtime, browser entry, configuration, errors, shared types, and
utilities grouped separately.
The HTTP adapter uses `@effect/platform/HttpClient` with scoped request cleanup;
tests replace its HTTP service rather than requiring real network access.
Delivery fibers belong to a scoped `FiberSet`, and a managed runtime owns their
lifetime. Effect execution is confined to the public client boundary; the
services themselves only return composable Effects.

Each execution gets a distinct run ID; business identifiers are optional
properties. HTTP delivery attaches a stable event UUID for retry deduplication.
The backend computes metrics, rather than trusting client-submitted aggregates.
Run context, explicit run links, steps, operations, progress, handled/unhandled
errors, reported results and terminal outcomes are persisted for the dashboard's
workflow-run investigation. Browser events remain untrusted client reports,
not authoritative business outcomes.

The `@flowmarkdev/node/browser` entry shares workflow and delivery behavior without
Node.js or Next.js imports and never reads server environment variables. It
supports two distinct delivery choices:

- Direct browser delivery to `POST /v1/browser-events`, using a public browser
  key and an allowed `Origin`. The API validates the key, origin and event
  envelope, applies a limit of 120 requests per minute per key, and stores
  events in the key's project. Browser workflows are prefixed with `browser.`
  if not already so prefixed.
- A same-origin customer route (`/api/flowmark` by default). A server-only
  proxy adds the private write key and forwards a Schema-validated envelope.
  It checks the request Origin, bounds input to 64 KiB, and offers an
  `authorize` callback for the application's own authentication and rate
  limiting.

Public browser keys are intentionally exposed and cannot read dashboard data or
use private server ingestion. Origin restrictions are not authentication or
abuse prevention; browser events are untrusted and must not be used as
authoritative proof of a business outcome. Never put private keys in browser
bundles or `NEXT_PUBLIC_*` variables. Delivery is best-effort with keepalive,
not durable offline/unload delivery.

## API services and adapters

The framework-independent API implementation lives in `packages/api` and is
consumed as `@flowmark/api`. It owns application errors, Effect use cases,
ports, database-backed adapters, and the default `ApiLive` layer composition.
It does not depend on Next.js or tRPC. Its ports and service layers are
available to other server applications so a future Hono, Express, GraphQL, or
other adapter can compose the same behavior.

`apps/server` is the current Next.js deployment shell. It owns route handlers,
request-body/protocol handling, tRPC router and fetch adapter, CORS, and HTTP
error mapping. Dashboard code imports the router type from
`@flowmark/server/trpc`; the dashboard does not import the API implementation
through the server package. Keep framework orchestration out of
`packages/api`, and keep workflow/application rules out of `apps/server`.

| Responsibility             | `packages/api` / `@flowmark/api`                                     | `apps/server` / `@flowmark/server`                    |
| -------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- |
| Workflow and project rules | Owns them in feature use cases                                       | Must not duplicate them                               |
| Dependency contracts       | Owns ports and tagged application errors                             | Supplies protocol inputs and maps errors to HTTP/tRPC |
| Persistence                | Owns the current database adapters and default `ApiLive` composition | Must not issue application SQL or choose repositories |
| Framework                  | No Next.js, tRPC, or HTTP-framework imports                          | Owns Next.js routes and tRPC orchestration            |
| Replacement                | Reused by any compatible server host                                 | Replaceable without moving API use cases              |

The package boundary is useful even before another framework is added: use
cases can be tested with injected ports, and HTTP/tRPC code cannot quietly
become the only place where application behavior exists. A new server adapter
should decode its framework request, call the appropriate `@flowmark/api`
service, and translate the `Exit`/typed errors into that framework's response.
It should not import `apps/server` or reimplement project access, event
validation, ingestion, or query rules.

For example, an HTTP or GraphQL resolver can call the same typed query without
knowing that Next.js or tRPC exists:

```ts
import { Effect } from "effect"
import { GetProjectWorkflowData, runApi } from "@flowmark/api"

const result = await runApi(
  Effect.flatMap(GetProjectWorkflowData, (queries) =>
    queries.snapshot(request.headers.get("authorization")),
  ),
  request.signal,
)
```

`runApi` uses the package's default scoped database composition. A host that
needs different persistence can compose the exported use-case layers with its
own implementations of the API ports instead.

The dependency direction is:

```text
apps/server (Next.js + tRPC + HTTP adapters) -> @flowmark/api -> ports
                                                        ^         |
                                                        └─ DB adapters
```

The API follows feature-first ports-and-adapters:

- `features/project-access/` groups the `authorize-project` use case, its
  credential port, and the live credential adapter.
- `features/workflows/` groups workflow event ingestion, browser ingestion,
  project workflow queries, the workflow repository port, and its adapter.
- Feature use cases compose Effect workflows without depending on HTTP, tRPC,
  or persistence-library details.
- Feature ports declare API-owned contracts and read models with Effect
  `Context.Tag`s; they do not derive their public types from database
  implementation types.
- Feature adapters implement those ports using the current database package
  and translate persistence failures into API-owned tagged errors. Their names
  describe the domain responsibility rather than locking the API layout to one
  database vendor.
- `AuthorizeProject` resolves the project from a redacted key and required
  permission, or from a signed-in user and project membership.
  Demo-mode policy is injected through `ApiSettings`.
- `IngestWorkflowEvents` authorizes before reading the lazy request payload,
  validates the event envelope with Effect Schema, then persists through
  `WorkflowRepository`. Browser event ingestion is a separate use case with
  browser-key, origin, and quota policy.
- Account registration creates the Better Auth user only. The first project
  and write key are created later via `ManageProject.create` (Settings /
  onboarding).
- `GetProjectWorkflowData` performs read authorization and project-scoped
  snapshot, workflow-list, and timeline queries. Dashboard calls use the
  `*ForUser` variants; programmatic callers may still use a project read key.
- `WorkflowRepository` exposes typed storage operations backed by the existing
  database package. Tests inject implementations without PostgreSQL or HTTP.

Use cases compose `Effect.fn`/`Effect.gen` operations without executing them
and do not depend on Next.js, Web Requests, Responses, or tRPC. HTTP/tRPC
adapters handle request decoding and protocol-specific error mapping; route
files only export handlers. Tests live in a package-level `test/` tree and
inject port implementations. The HTTP body reader limits streamed input to 64 KiB and
releases its reader on success, invalid input, or interruption.

The HTTP API exposes `GET /api/health`, Better Auth `GET|POST /api/auth/*`,
`POST /api/register`, `GET|POST|OPTIONS /api/trpc`, private `POST /v1/events`,
and browser `POST|OPTIONS /v1/browser-events`. tRPC provides `health.check`,
`project.snapshot`, `workflow.list`, `run.detail`, and `run.related`. Dashboard
reads use a signed-in session cookie forwarded by the dashboard proxy;
programmatic reads may still use a project read key when no session is
present. Browser ingestion uses CORS preflight and the browser-key origin
allowlist; it does not grant read access or authorize a private-key write.

`runtime.ts` composes the live layers and executes effects at the request
boundary. Database acquisition/release belongs to a scoped database adapter,
so connections close on success, failure, and interruption. Request abort
signals interrupt the request effects. Initialization and cleanup failures
preserve operation/cause and become explicit failures, not successful responses.
The health endpoint remains a database-independent liveness check.

## Persistence and isolation

The `@flowmark/db/persistence` entry point is a barrel over Effect
persistence services: `WorkflowStore` for append/snapshot/timeline/related
reads, and `ProjectCredentialsStore` for key authentication, browser quota,
and project membership. Feature folders split `queries/`, `writes/`, and raw
`sql/` beside those services. Auth tables and the Better Auth factory live
under `packages/db/src/{schema,auth}`. Drizzle and PostgreSQL types stay
inside this persistence package; the API consumes its own repository ports
and read models.

Versioned Drizzle migrations create Better Auth users/sessions, workspaces,
projects, project members, hashed project API keys, workflow definitions,
runs and append-only events. Unique constraints prevent duplicate workflow
definitions, runs and retried events. Event ingestion requires a write key;
dashboard queries require a signed-in session and project membership. The
project is resolved from the session or key, never accepted from the request
body. Queries and run detail lookups always include that project.

The database is an injected Effect service. Driver promises are converted at the
driver boundary; typed errors preserve operation/cause. HTTP/tRPC boundaries
execute the effects and return explicit errors. Ingestion acknowledges a write
only after the database transaction commits.

## Local auth and demo fixtures

`pnpm db:setup` applies committed migrations and provisions the operations and
diagnostics projects plus development-only read, server-write, and
browser-write credentials. `pnpm db:migrate` applies schema only;
`pnpm db:seed` provisions fixtures only. Seed requires
`FLOWMARK_DEMO_MODE=true` and a loopback database, and it refuses production.
The API rejects demo credentials unless demo mode is explicitly enabled, and
it rejects demo mode when `NODE_ENV` or `VERCEL_ENV` is production. The
browser key is public by design; the read and server write keys must remain
server-side.

Dashboard sign-in is Better Auth email and password. The dashboard's
same-origin proxy forwards `/api/auth/*`, `/api/register`, and `/api/trpc/*`
to the API so the session cookie stays first-party. Anonymous dashboard reads
are rejected. Seed creates `local@dev` on the operations project. New
registrations create an account only; the first project and write key are
created explicitly in Settings / onboarding. Password reset is off until
email delivery exists. Do not enable demo mode for real customer data.

## Limits

Delivery is best-effort with a bounded in-memory pending set, no durable queue or
batching. The dashboard fetches the latest 100 runs and aggregates metrics across
all recorded runs; daily volume covers the last 30 UTC days. The local harness
simulates invoice, inventory and order work per execution, while workflow history
is persistent. Technical SDK diagnostics use a separate local project.

The reference deployment is the four public hostnames in the
[infrastructure guide](./infrastructure). Alerting, retention cleanup,
durable delivery, and a backup restore drill are not implemented. A
register-and-ingest pass against that deployment has not been recorded.
The direct browser-key quota is a basic per-key limit, not production-grade
abuse prevention. No offline queue or durable delivery guarantee exists.
