export function flowmarkApiOrigin(): string {
  return process.env.NODE_ENV === "development"
    ? "http://localhost:3003"
    : "https://api.flowmark.dev"
}

export function flowmarkAgentPrompt(apiOrigin: string): string {
  return [
    "Set up Flowmark in this repository.",
    "",
    "Flowmark is workflow observability for processes this application already runs. It records evidence; it does not execute, schedule, or retry work.",
    "",
    "Install `@flowmarkdev/node` with `npm i @flowmarkdev/node`. Do not invent a client, wrapper, package, or API. If install fails, stop and report it.",
    "",
    "Create one shared client module. Never construct a client per file or import a Node/Next entry in a Client Component.",
    "",
    "Next.js Route Handler or Server Action, in a server-only module:",
    "",
    'import { createFlowmark } from "@flowmarkdev/node/next"',
    "export const flowmark = createFlowmark()",
    "",
    "Node worker, script, or long-lived server:",
    "",
    'import { createFlowmark } from "@flowmarkdev/node"',
    "export const flowmark = createFlowmark()",
    "",
    "Set these on the server only. Never use NEXT_PUBLIC_, commit, print, or chat-paste the write key. Ask the human to configure it in the environment.",
    "",
    "FLOWMARK_API_KEY=<write key from Flowmark dashboard Settings>",
    `FLOWMARK_API_URL=${apiOrigin}`,
    "",
    "FLOWMARK_API_URL is the API origin, not a path ending in /v1/events.",
    "",
    "Use only this public API: workflow(name, options), step(name), operation(name, callback), progress({ completed, total?, unit? }), error({ code, handled, retryable? }), setProperties(properties), done({ result? }), fail({ code, result? }). Node also has flush()/shutdown(); Next.js drains itself. There is no track(), span(), or metric().",
    "step() is an instantaneous milestone. operation() measures work but does not fail the run by itself. progress() is an absolute snapshot, not a heartbeat. error() is non-terminal. Only done()/fail() set the reported outcome. Flowmark does not retry.",
    "",
    "Choose exactly one real process for the first pass, and instrument it only when all four are true:",
    "1. It spans meaningful work, several operations, or time. One request qualifies when its operations and outcome are worth understanding.",
    "2. Someone needs to understand one execution.",
    "3. The application has useful progress, events, or outcomes to report.",
    "4. Logs or an APM do not already give a convenient process-level view.",
    "",
    "Strong fits: imports, data processing, checkout, multi-request processes, background jobs, and external integrations.",
    "Weak fit: ordinary create, read, update, and delete handlers where one request log already answers the question. Skip those and say why.",
    "",
    "Keep the function's return value and thrown errors. Telemetry failure must never change business behavior.",
    "",
    "If it finishes here, call done() or fail() before returning. If it continues later, choose a fresh execution ID, persist it on the application record, and pass it as workflow(name, { id: executionId }) on later requests. Do not use a durable entity ID, such as an order ID reused across executions, as the execution ID. Put entity IDs in properties.",
    "",
    "Pass a small JSON-safe result the application already knows: counts, status enums, or opaque IDs. Do not send identities, emails, tokens, secrets, request bodies, database records, raw exceptions, or sensitive personal data. A completed run is a report, not proof every record succeeded; include skipped or rejected counts when available.",
    "",
    "Browser code, if any, uses @flowmarkdev/node/browser and a public browser key, or a server proxy. Never put the server write key in a browser bundle.",
  ].join("\n")
}
