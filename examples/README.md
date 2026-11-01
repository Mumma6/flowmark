# SDK usage examples

Illustrative TypeScript excerpts for [`@flowmarkdev/node`](https://www.npmjs.com/package/@flowmarkdev/node).
They show where Flowmark fits into application code that already does the work.

These files are not applications, tests, or scripts. Helper functions such as
`upsertCustomer()` are declared so the snippet can focus on instrumentation.
Every Flowmark call matches the current SDK. `tsconfig.json` maps
`@flowmarkdev/node` to the SDK in this repository so the editor can resolve
those imports. It does not install or publish a package.

Flowmark observes a run. It does not execute, schedule, or retry the work.

Runnable loopback scripts live separately in `packages/sdk/examples/`.

## Scenarios

| Example                     | Situation                        | SDK concepts                                                                                                                                                                                    |
| --------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flowmark.ts`               | Shared Node.js client            | `defineConfig`, `apiUrl`, `createFlowmark`, `FlowmarkConfigError`, `FlowmarkQueueError`, `FlowmarkExpectationError`, `FlowmarkErrorMappingError`, `WorkflowTransportError`, `FlowmarkHttpError` |
| `basic-workflow.ts`         | Checkout                         | `workflow`, `WorkflowProperties`, `step`, `operation`, `done`, `fail`                                                                                                                           |
| `customer-import.ts`        | Typed customer import            | `WorkflowDefinition`, context, result, `WorkflowOutcome`, `setProperties`, `report`, `done`, `fail` with `message` and `retryable`                                                              |
| `intermediate-reporting.ts` | Page-by-page import              | `WorkflowResult`; `report` replaces the previous snapshot                                                                                                                                       |
| `batch-progress.ts`         | Price file                       | `WorkflowProgress`, `DeliveryOptions` with `progress: "latest"`                                                                                                                                 |
| `manual-operation.ts`       | Encoder the caller closes        | `WorkflowOperation`, `operationId`, handle `done()` and `fail()`                                                                                                                                |
| `crm-sync.ts`               | Account push with a second try   | `WorkflowAttempt`, `OperationErrorMapper`                                                                                                                                                       |
| `retry-tracking.ts`         | A later import run               | `WorkflowRetryReference`; `retryOf` starts a new run                                                                                                                                            |
| `booking-process.ts`        | Booking and provider evidence    | `ExpectationOptions`, `ExpectationReference`, `ExpectationResolution`, `ExpectationCancellation`                                                                                                |
| `workflow-continuation.ts`  | Draft, then a later review       | `WorkflowRunReference`; same name and `id`; `setProperties`                                                                                                                                     |
| `webhook-processing.ts`     | Payment callback                 | `WorkflowRunId`; continue a stored run                                                                                                                                                          |
| `background-job.ts`         | Invoice reconciliation           | Per-run `release`, `flush`, `FlowmarkDeliveryError`, `DeliveryHealth`, `shutdown`                                                                                                               |
| `error-handling.ts`         | Campaign delivery fallback       | `WorkflowError`, `WorkflowFailure`; `error` stays non-terminal                                                                                                                                  |
| `concurrent-operations.ts`  | Inventory and payment together   | Overlapping `operation` callbacks; `done` waits for open handles                                                                                                                                |
| `correlated-workflows.ts`   | Fulfillment and a shipping label | `WorkflowCorrelationId`, `parentRunId`                                                                                                                                                          |
| `next-route.ts`             | Next.js server action            | `@flowmarkdev/node/next`, `defineConfig`, `onDeliveryHealth`; no `shutdown`                                                                                                                     |
| `browser-checkout.ts`       | Browser checkout                 | `@flowmarkdev/node/browser`, `proxyPath`, `publicKey`, `flush`, `shutdown`                                                                                                                      |
| `proxy-route.ts`            | Same-origin proxy                | `createFlowmarkProxy` from `@flowmarkdev/node/next/proxy`                                                                                                                                       |
| `custom-transport.ts`       | In-memory delivery               | `MemoryTransport`, `WorkflowTransport`, `createFlowmarkWithTransport`, low-level `workflow()`, `WorkflowEvent`                                                                                  |

## Usage notes

Create one client for the process. Pass durable ids such as an order or batch
id in `properties`, and keep one execution's id in `runId`. Context, result,
and outcome on `defineWorkflow` describe that run. An `outcome` is the business
result your code reports. It is independent of whether the run completed or
failed.

`@flowmarkdev/node/proxy` is the same proxy function as
`@flowmarkdev/node/next/proxy`. `delivery.progress: "all"` keeps every progress
snapshot; `"latest"` replaces adjacent unsent progress for one handle.
