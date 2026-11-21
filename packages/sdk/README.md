# Flowmark

The TypeScript runtime for Flowmark application memory. Adapters and repository agents use it to record selected decisions, execution outcomes and later confirmations around application-owned work. This is the integration reference for the existing runtime. See the [agent operating model](../../docs/agent-workflow.md) for the intended installation and maintenance flow.

```sh
npm install @flowmarkdev/node
```

Requires Node.js 20.19+; the Next.js adapter requires Next.js 16+.

Set your server credential:

```sh
FLOWMARK_API_KEY=your-project-write-key
```

## Next.js

Create a shared server-only client:

```ts
import { createFlowmark } from "@flowmarkdev/node/next"

export const flowmark = createFlowmark()
```

Use it inside a Route Handler or Server Action:

```ts
return flowmark.workflow("invoice.import", async (flow) => {
  const result = await flow.operation("save-invoices", () => saveInvoices())
  flow.done({
    outcome: result.rejected > 0 ? "partial" : "complete",
    result: { imported: result.imported, rejected: result.rejected },
  })
  return result
})
```

`saveInvoices()` is your existing application function. The callback completes on
return and records unexpected failures while preserving the original error.
Next.js handles delivery automatically.

For scripts and workers, import from `@flowmarkdev/node` and await
`flowmark.shutdown()` before exit. Hosted delivery is the default; set
`FLOWMARK_API_URL` for a local or staging API. Keep the write key server-only.

[Next.js guide](https://docs.flowmark.dev/docs/nextjs) ·
[Node.js guide](https://docs.flowmark.dev/docs/nodejs) ·
[API reference](https://docs.flowmark.dev/docs/reference) ·
[AI setup guide](https://api.flowmark.dev/v1/instrumentation)

[Apache-2.0](./LICENSE)
