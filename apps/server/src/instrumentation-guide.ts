/** Public instrumentation guide. No credentials. The origin is the API the caller fetched. */
export function instrumentationGuide(apiOrigin: string): string {
  return `# Set up Flowmark

Flowmark records evidence from processes this application already runs. It does not execute, schedule, or retry that work.

Install \`@flowmarkdev/node\` with \`npm i @flowmarkdev/node\`. Do not invent a client, wrapper, package, or API. If install fails, stop and report it.

Create one shared client module. Never construct a client per file or import a Node or Next entry in a Client Component.

Fetching this guide does not connect an agent.

## Server environment

Set these on the server only. Never use \`NEXT_PUBLIC_\`, commit, print, or paste the write key into chat. Ask the human to configure it in the environment.

\`\`\`
FLOWMARK_API_KEY=<write key from Flowmark Studio Settings>
FLOWMARK_API_URL=${apiOrigin}
\`\`\`

\`FLOWMARK_API_URL\` is the API origin, not a path ending in \`/v1/events\`.

## Where the client lives

Next.js Route Handler or Server Action, in a server-only module:

\`\`\`ts
import { createFlowmark } from "@flowmarkdev/node/next"

export const flowmark = createFlowmark()
\`\`\`

The Next.js client drains with \`after()\`. Do not call \`shutdown()\` yourself. Its methods are \`workflow\`, \`defineWorkflow\`, \`resolveExpectation\`, and \`cancelExpectation\`. Pass \`onDeliveryHealth\` when you need the final local counters. A delivery failure is logged and leaves the application's return value and thrown errors unchanged.

Node worker, script, or long-lived server:

\`\`\`ts
import { createFlowmark } from "@flowmarkdev/node"

export const flowmark = createFlowmark()
\`\`\`

Call \`await flowmark.flush()\` to drain without closing the client, and \`await flowmark.shutdown()\` before the process exits. Either call can reject when delivery fails. \`deliveryHealth()\` is cumulative local counters with no payloads or secrets.

Browser code imports \`@flowmarkdev/node/browser\` and calls \`workflow()\` only from an event handler or effect, not during render. Use \`publicKey\` with \`apiUrl\` for direct delivery, or omit both and send through a same-origin proxy at \`/api/flowmark\` (\`@flowmarkdev/node/proxy\`). Never put the server write key in a browser bundle. The browser client does not read \`FLOWMARK_*\`. Keepalive delivery does not guarantee offline or unload delivery.

## First process

Start with one real process and the small public surface: \`workflow(name, options?)\`, \`step(name)\`, \`operation(name, callback)\`, \`progress({ completed, total?, unit? })\`, \`error({ code, handled, retryable? })\`, \`setProperties(properties)\`, \`done({ outcome?, result? })\`, and \`fail({ code, outcome?, result? })\`. There is no \`track()\`, \`span()\`, or \`metric()\`.

\`step()\` is an instantaneous milestone. \`operation()\` measures work, preserves the callback's return value or original rejection, and does not fail the run. \`progress()\` is an absolute snapshot, not a heartbeat. \`error()\` is non-terminal. Only \`done()\` and \`fail()\` set the reported outcome. Flowmark does not retry.

Instrument it only when all four are true:

1. It spans meaningful work, several operations, or time. One request qualifies when its operations and outcome are worth understanding.
2. Someone needs to understand one execution.
3. The application has useful progress, events, or outcomes to report.
4. Logs or an APM do not already give a convenient process-level view.

Strong fits: imports, data processing, checkout, multi-request processes, background jobs, and external integrations. Ordinary create, read, update, and delete handlers are a weak fit when one request log already answers the question. Skip those and say why.

Keep the function's return value and thrown errors. Telemetry failure must never change business behavior.

If the process finishes in this call, use \`done()\` or \`fail()\` before returning. If it continues later, choose a fresh execution ID, persist it on the application record, and pass \`workflow(name, { id: executionId })\` on later requests. The same workflow name and id continues that run. Do not use a durable entity ID, such as an order ID reused across executions, as the execution ID. Put entity IDs in \`properties\`.

Pass a small JSON-safe result the application already knows: counts, status enums, or opaque IDs. Do not send identities, emails, tokens, secrets, request bodies, database records, raw exceptions, or sensitive personal data. A completed run is a report, not proof every record succeeded. Include skipped or rejected counts when the application already has them.

## Outcomes and reports

Add these only when the process has a business result worth reporting.

\`outcome\` is independent of technical completion or failure. Absence means unreported. \`done({ outcome, result })\` and \`fail({ code, outcome, result })\` carry it explicitly. Fields inside \`result\` are ordinary application data.

\`flow.report(snapshot)\` records an absolute non-final snapshot. Omitted fields become unknown and are not inherited by \`done()\` or \`fail()\`. A report does not close the run, change progress, or set the outcome. Calls after a terminal request are ignored.

\`defineWorkflow<Context, Result, Outcome>(name).start(options)\` is an optional typed handle on the same client. Creating the definition emits nothing. The type arguments are erased at runtime and do not register a dashboard declaration.

## Relationships

Add these only when the application is relating runs on purpose.

Pass \`correlationId\` and \`parentRunId\` yourself on \`workflow()\`. Nothing is copied onto later runs automatically. They are not causal proof. \`parentRunId\` is that run's SDK id, \`flow.runId\`, not a dashboard UUID.

\`retryOf\` starts a separate run with a new id. It does not continue the previous run. \`operation(..., { attempt })\` records an attempt inside one run and operation name. Both require a server that acknowledges \`attempts-v1\`. \`mapError\` only selects safe failure fields for that callback. Flowmark still does not retry the work.

## Expectations

Add these only when later evidence should be observed.

\`flow.expect(name, options)\` declares a deadline. It does not wait, perform the work, or verify the later response. \`resolveExpectation\` and \`cancelExpectation\` are client methods. They can settle after the run ends, and they do not reopen the run or replace its final result.

These events require a server that acknowledges \`expectations-v1\`. A missing acknowledgment is a delivery failure, not a silent drop. The generic server-key proxy rejects expectation events. Direct browser expectations use a public browser key and stay untrusted.

Respect capability diagnostics. On Node, \`flush()\` and \`shutdown()\` reject when delivery fails. On Next.js, the adapter logs that failure. In every case, leave the application's return value and thrown errors unchanged.
`
}
