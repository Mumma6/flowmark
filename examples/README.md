# SDK usage examples

Illustrative TypeScript excerpts for [`@flowmarkdev/node`](https://www.npmjs.com/package/@flowmarkdev/node).
They show where Flowmark fits into application code that already does the work.

Except for the runnable `read-run.ts` consumer below, these files are not applications, tests, or scripts. Helper functions such as
`upsertCustomer()` are declared so the snippet can focus on instrumentation.
Every Flowmark call matches the current SDK. `tsconfig.json` maps
`@flowmarkdev/node` to the SDK in this repository so the editor can resolve
those imports. It does not install or publish a package.

Flowmark observes a run. It does not execute, schedule, or retry the work.

Runnable loopback scripts live separately in `packages/sdk/examples/`.

[`SETUP-DEMO.md`](./SETUP-DEMO.md) documents a **memory-first** runnable demo
for `booking-process.ts` (optional loopback delivery for Studio verification).
Run it with `pnpm --filter @flowmarkdev/node test booking-setup-demo`.

## Scenarios

| Example                      | Situation                        | SDK concepts                                                              |
| ---------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| `flowmark.ts`                | Shared Node.js client            | `defineConfig`, `createFlowmark`, instrumentation errors                  |
| `basic-workflow.ts`          | Checkout                         | `workflow`, `step`, `operation`, `done`, `fail`                           |
| `customer-import.ts`         | Typed customer import            | `defineWorkflow`, `start`, outcomes `complete` and `partial`              |
| `intermediate-reporting.ts`  | Page-by-page import              | `report` replaces the non-final snapshot; `done` carries the final result |
| `batch-progress.ts`          | Price file                       | Absolute `progress`; `delivery.progress: "latest"`                        |
| `crm-sync.ts`                | Account push with a second try   | Operation `attempt`, `mapError`; the application owns the retry           |
| `retry-tracking.ts`          | A later import run               | `retryOf` starts a new run and does not continue the previous one         |
| `booking-process.ts`         | Booking and provider evidence    | `expect`, `resolveExpectation`, `cancelExpectation`                       |
| `booking-setup-scenarios.ts` | Shared booking demo helpers      | Same markers as `booking-process.ts`; see SETUP-DEMO.md                   |
| `workflow-continuation.ts`   | Draft, then a later review       | Same name and `id`; `setProperties` while the run is open                 |
| `webhook-processing.ts`      | Payment callback                 | Continue a stored `runId`; terminal `done` or `fail`                      |
| `background-job.ts`          | Invoice reconciliation           | `flush`, `shutdown`, `deliveryHealth`                                     |
| `error-handling.ts`          | Campaign delivery fallback       | `operation` rethrows; `error` stays non-terminal; `fail` ends the run     |
| `concurrent-operations.ts`   | Inventory and payment together   | Overlapping operations; `done` waits for open handles                     |
| `correlated-workflows.ts`    | Fulfillment and a shipping label | Explicit `correlationId` and `parentRunId`                                |
| `next-route.ts`              | Next.js server action            | `@flowmarkdev/node/next`, `onDeliveryHealth`; no manual `shutdown`        |

## Usage notes

Create one client for the process. Pass durable ids such as an order or batch
id in `properties`, and keep one execution's id in `runId`. An `outcome` is the
business result your code reports. It is independent of whether the run
completed or failed.

Browser delivery (`@flowmarkdev/node/browser`), the server proxy, and custom
transports are client setup rather than workflow scenarios, so they are not
included here.

## Public read consumer

`read-run.ts` is a runnable server-side consumer of `@flowmarkdev/node/read`.
It reads one Studio selection JSON file and an optional continuation cursor;
`FLOWMARK_API_URL` and `FLOWMARK_READ_KEY` are environment-only configuration.
See [setup, limits and errors](../docs/sdk/public-run-read.md#run-the-repository-consumer).
The subpath is implemented in repository source; npm publication is separate.

The same consumer also accepts a version-1 technical period selection, comparing
current and previous windows with explicit coverage and empty-baseline guidance.
See [the supported question and limits](../docs/sdk/public-period-read.md).

The [public client guide](../apps/docs/content/docs/public-reads.mdx) documents
local read-key creation, error recovery and packaging/version boundaries without
requiring hosted credentials or private plans.
