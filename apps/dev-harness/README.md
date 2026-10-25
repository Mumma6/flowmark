# Flowmark Local Dev Harness

**Local development only. Never deploy or expose this app.** Dev and start
commands intentionally bind to `127.0.0.1:3004`. The fictional Fieldwork
Operations app uses synthetic records and simulated storage, suppliers and
carrier calls. Nothing is charged, imported into a real system, or shipped.

## Run locally

1. Follow the [local PostgreSQL setup](../../docs/development.md#local-demo-with-postgresql).
2. Run `pnpm dev:setup`, configure the server's local database, then run
   `pnpm db:setup`. Setup migrates and provisions separate operations and SDK
   diagnostics projects; existing credentials are retained.
3. Start the API on 3003, dashboard on 3001, and harness on 3004:
   `pnpm --filter @flowmark/dev-harness dev`.
4. Open [the harness](http://127.0.0.1:3004) and choose an operation or
   **Run all six scenarios**. Each click calls the harness's application
   endpoint, which executes ordinary SDK-instrumented work. There are no
   database-inserted fake telemetry fixtures.
5. Open [the dashboard](http://localhost:3001) and sign in as `local@dev` /
   `local-dev-only` after `pnpm db:setup`. Telemetry delivery may finish
   shortly after the application response, using the Next.js `after()` adapter.

## Operations

| Workflow          | Cases                                           | What to investigate                                                                                                       |
| ----------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `invoices.import` | Valid file; two rejected invoices               | Completion can include rejected records. The timeline names INV-1003's missing date and INV-1005's invalid amount.        |
| `inventory.sync`  | Three pages saved; supplier times out on page 3 | Last progress is 8/12 and the last saved page is 2. Do not assume the other four stock levels changed.                    |
| `orders.fulfill`  | Ready for dispatch; carrier unavailable         | Stock was already reserved before label creation failed. Retry the label in your application, not the entire reservation. |

Each case creates a new run of a stable workflow name. Context records a
batch/sync/order reference, local environment, scenario and synthetic-data
marker. Operations are timed; progress is absolute; errors and failures are
explicit. Successful runs attach business results. Failed runs retain
checkpoints rather than attaching a fake completion result.

The operations UI shows source records, outcomes and a concrete next action.
Execution links prefill the dashboard search with the SDK run ID, so only
that execution is listed (within the dashboard's latest-100-run snapshot).
The execution list retains the last 30 results in the current page session;
reloading clears it. PostgreSQL retains Flowmark history. Switching cases
shows that case's source and most recent execution, not another case's status.
Every execution starts an independent simulation: the sample app does not
implement persistent business state, production retries or real imports.

## SDK diagnostics are isolated

The separate [SDK diagnostics page](http://127.0.0.1:3004/diagnostics) preserves
the low-level lifecycle, context, errors, operations, progress and related-run
checks in Browser, Next.js and Node runtimes. Their technical names are useful
here, but **never write into the operations project**:

- Operations: fixed local project `00000000-0000-4000-8000-000000000002`.
- SDK diagnostics: project `00000000-0000-4000-8000-000000000003`.
- Diagnostic server and proxy routes use `fm_diagnostics_write_local_only`.
- Browser diagnostics use the public `fm_diagnostics_browser_local_only`,
  restricted to loopback origins. Never use these public development
  credentials for real data.

These are actual ingestion checks. Browser and Node clients flush and shut
down; Next uses request-scoped delivery. Failures marked intentional are
expected. Diagnostics do not link into the operations dashboard because it
reads a different project. The original Todo example has been replaced by
the operations app; diagnostic cases retain the SDK coverage.

## Reset only the operations history

```sh
pnpm db:reset-local-telemetry -- --confirm-local-telemetry
```

This destructive command requires `FLOWMARK_DEMO_MODE=true`, a loopback
database URL and explicit confirmation. It transactionally deletes only
events, runs and workflows belonging to the fixed operations project.
Workspaces, projects, keys, diagnostics and other projects are retained.
Then use **Run all six scenarios** in the app to record fresh history.
Reset is never automatic on startup and is not exposed as an HTTP endpoint.

## Structure and verification

- `lib/operations-catalog.ts`: synthetic inputs, case descriptions and typed
  response schema.
- `lib/business-scenarios.ts`: application work and additive SDK markers.
- `app/api/scenarios/route.ts`: validated request boundary.
- `app/operations-app.tsx`, `scenario-records.tsx`, `harness-shell.tsx`:
  shared-shadcn UI, navigation, source tables and execution feedback.
- `lib/sdk-scenarios.ts`, `app/sdk-playground.tsx`, `app/api/sdk-tests/route.ts`:
  isolated technical diagnostics.

All UI styling uses Tailwind utilities and shared `@flowmark/ui` components.
Global CSS contains only theme tokens and Tailwind directives.

```sh
pnpm --filter @flowmark/dev-harness test
pnpm --filter @flowmark/dev-harness lint
pnpm --filter @flowmark/dev-harness typecheck
pnpm --filter @flowmark/dev-harness build
```
