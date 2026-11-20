/** Public setup instructions for the verified first-run SDK path. */
export function instrumentationGuide(apiOrigin: string): string {
  const urlEnvironment =
    apiOrigin === "https://api.flowmark.dev"
      ? ""
      : `\n\`FLOWMARK_API_URL=${apiOrigin}\``
  return `# Add Flowmark to one existing process

Flowmark records application executions. Work and retries stay in your app.

## 1. Inspect and propose

Check the runtime, lockfile, installed SDK and existing Flowmark wrappers. Use
the repository's package manager. Shortlist two or three processes with their
entry points, why they matter, the evidence to collect and what remains unknown.
Show the first patch and its proposed fields. Wait for approval before installing
or editing. Start with one approved process, before its first relevant I/O.

## 2. Pick the documented runtime path

These examples use \`@flowmarkdev/node\` 0.4.x and Node.js 20.19 or newer. The
Next adapter requires Next.js 16 or newer, App Router and the Node.js runtime.
On a new install, use \`npm i @flowmarkdev/node@0.4\` or the equivalent for the
repository. If a different version is installed, check that version's package
README and types and use its supported path. If support is unclear, say what
you cannot verify. A supported Node.js worker or CLI can use the base SDK.
Check the [manual quickstart](https://docs.flowmark.dev/docs/sdk) and
[Node.js guide](https://docs.flowmark.dev/docs/nodejs) if setup needs a fallback.

The developer sets the write key in the server environment. Keep it out of chat,
source and \`NEXT_PUBLIC_*\`. A Node process must load its environment before
creating the client. Use the API origin, not a path ending in \`/v1/events\`.
Hosted delivery defaults to https://api.flowmark.dev.

\`FLOWMARK_API_KEY=<project server-write key>\`${urlEnvironment}

### Next.js Route Handler or Server Action

Share a client in a server-only module. Call it inside the handler or action.
The adapter delivers after the request and owns shutdown. Pages API routes,
Edge, Proxy and rendering are outside this example.

\`\`\`ts
// lib/flowmark.ts
import { createFlowmark } from "@flowmarkdev/node/next"

export const flowmark = createFlowmark()
\`\`\`

Wrap the existing function after the handler's authorization and input
validation. Keep the application's return value, thrown error and retry behavior.

\`\`\`ts
// Inside the existing handler or action after validation:
const result = await flowmark.workflow("invoice.import", () => importInvoices())
\`\`\`

### Standalone Node.js script or worker

Use the base SDK and drain at the process boundary. Handle delivery failure
separately so it cannot replace the application's original result or error.
Long-lived workers reuse the client and can flush between jobs.

\`\`\`ts
import { createFlowmark } from "@flowmarkdev/node"
import { importInvoices } from "./import-invoices"

const flowmark = createFlowmark()
try {
  await flowmark.workflow("invoice.import", () => importInvoices())
} finally {
  try {
    await flowmark.shutdown()
  } catch (error) {
    console.error("Flowmark delivery failed", error)
  }
}
\`\`\`

## 3. Verify the first run

Use a safe existing test or local action. Check that the application still
returns the same value or throws the original error. Check SDK delivery
diagnostics separately and look up the persisted run in the intended project.
Report what ran, what arrived and what you read back. State which paths you
could not safely exercise. If evidence is missing, check project, API origin
and [delivery diagnostics](https://docs.flowmark.dev/docs/delivery). Leave
configuration errors visible and keep the application's normal retry policy.

The callback records completion on return and failure on an unhandled exception.
A returned value stays in the app. To record counts the application already
knows, approve the fields first and use [reported results](https://docs.flowmark.dev/docs/reference/completion).
Keep secrets, raw exceptions and personal data out of telemetry. Use the
[SDK reference](https://docs.flowmark.dev/docs/reference) for optional evidence
or work that continues across invocations.

## 4. Investigate recorded evidence

Use Studio to open the first run or use [MCP](https://docs.flowmark.dev/docs/mcp)
after the developer approves read access to the project. The coding agent reads
source in its own workspace. MCP supplies recorded evidence.

Call \`get_connection\` to confirm the project and available tools. Use
\`list_workflows\` when the process is unknown, then a bounded UTC \`find_runs\`.
Pass a returned run ID to \`get_run\` for the summary and one relevant page.
Cite the run and any supporting link. Separate recorded observations, source
inferences and recommendations. Completion does not establish business success.
Empty, partial or denied reads leave evidence unknown. Confirm the project,
window or grant as appropriate, and use Studio if MCP is unavailable.
`
}
