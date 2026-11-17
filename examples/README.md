# Flowmark examples

TypeScript examples for [@flowmarkdev/node](https://www.npmjs.com/package/@flowmarkdev/node).
Most are excerpts: application helpers are declared so the code focuses on
instrumentation. Flowmark observes work; the application owns execution and retries.

## Start here

- [Shared Node client](./flowmark.ts) and [checkout workflow](./basic-workflow.ts).
- [Next.js server action](./next-route.ts) with automatic delivery.
- [Typed customer import](./customer-import.ts) with complete/partial outcomes.
- [Worker delivery and shutdown](./background-job.ts).
- [Concurrent operations](./concurrent-operations.ts),
  [progress](./batch-progress.ts) and [intermediate results](./intermediate-reporting.ts).

The callback form observes one invocation. The
[continuation](./workflow-continuation.ts) and [webhook](./webhook-processing.ts)
examples deliberately use manual markers across requests. The
[error handling](./error-handling.ts), [CRM retry](./crm-sync.ts),
[retry link](./retry-tracking.ts) and [related workflows](./correlated-workflows.ts)
examples show explicit application decisions.

## Advanced examples

- [Booking expectations](./booking-process.ts), [runnable demo](./SETUP-DEMO.md)
  and [code-owned metadata](./code-owned-booking.ts).
- [Explicit trace references](../packages/sdk/examples/trace-context/README.md).
- [Public read consumer](./read-run.ts):
  [setup and limits](../docs/sdk/public-run-read.md#run-the-repository-consumer).
- [Portable evidence](./portable-evidence/README.md).

Runnable SDK scripts live in `packages/sdk/examples/`. Their HTTP demonstrations
require an explicit loopback API and synthetic write key; the outcomes example
uses memory only. The packed-consumer check compiles these TypeScript examples
against the package exports and runs the SDK scripts against a loopback receiver.

[SDK guides](https://docs.flowmark.dev/docs/sdk) · [Apache-2.0](./LICENSE)
