#!/usr/bin/env node
/** Build, pack and install the SDK into a real external Next.js/Node consumer.
 * No hosted service or credentials. Run with pnpm --filter @flowmarkdev/node test:consumer.
 */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"

const root = fileURLToPath(new URL("../", import.meta.url))
const { instrumentationGuide } = await import(
  new URL("../apps/server/src/instrumentation-guide.ts", import.meta.url)
)
const directory = await mkdtemp(join(tmpdir(), "flowmark-sdk-consumer-"))
const consumer = join(directory, "app")
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      !key.startsWith("FLOWMARK_") &&
      !["DATABASE_URL", "TEST_DATABASE_URL", "NODE_ENV", "PORT"].includes(key),
  ),
)
// This is an automated fixture, including when invoked locally. Avoid interactive
// framework upgrade prompts; dependency upgrades belong to the owning repository.
const environment = {
  ...cleanEnv,
  CI: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  NODE_ENV: "production",
}
let child
let logs = ""
const received = []
let retryEnvelope
let retrySent = false
const receiver = createServer(async (request, response) => {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const envelope = JSON.parse(Buffer.concat(chunks).toString())
  received.push(envelope)
  assert.equal(request.url, "/v1/events")
  if (request.headers.authorization === "Bearer synthetic-rejected") {
    response.writeHead(401).end()
    return
  }
  assert.equal(request.headers.authorization, "Bearer synthetic-write-key")
  if (!retrySent && envelope.event.type === "operation_started") {
    retrySent = true
    retryEnvelope = envelope
    response.writeHead(503).end()
    return
  }
  response.writeHead(202, { "content-type": "application/json" }).end(
    JSON.stringify({
      accepted: true,
      capabilities: ["attempts-v1", "expectations-v1"],
    }),
  )
})

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  return server.address().port
}
async function run(command, args, cwd = root, env = environment) {
  const process = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  process.stdout.on("data", (chunk) => {
    output += chunk
  })
  process.stderr.on("data", (chunk) => {
    output += chunk
  })
  await new Promise((resolve, reject) => {
    process.once("error", reject)
    process.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(
            new Error(`${command} ${args.join(" ")} exited ${code}\n${output}`),
          ),
    )
  })
  return output
}
async function eventually(check, description) {
  const deadline = Date.now() + 45000
  while (Date.now() < deadline) {
    if (await check()) return
    await delay(100)
  }
  throw new Error(`Timed out: ${description}\n${logs}`)
}
async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const owned = child
  await new Promise((resolve) => {
    const timer = setTimeout(() => owned.kill("SIGKILL"), 10000)
    owned.once("exit", () => {
      clearTimeout(timer)
      resolve()
    })
    owned.kill("SIGTERM")
  })
  child = undefined
}
async function start(extraEnv) {
  const reservation = createServer()
  const port = await listen(reservation)
  await new Promise((resolve) => reservation.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  child = spawn(
    process.execPath,
    [
      join(consumer, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: consumer,
      env: { ...environment, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    },
  )
  child.stdout.on("data", (chunk) => {
    logs += chunk
  })
  child.stderr.on("data", (chunk) => {
    logs += chunk
  })
  await eventually(async () => {
    if (child.exitCode !== null) throw new Error(`Next exited\n${logs}`)
    return fetch(origin).then(
      (response) => response.ok,
      () => false,
    )
  }, "Next production server readiness")
  return origin
}
const eventsFor = (id) =>
  received.filter(({ event }) => event.runId === id).map(({ event }) => event)

try {
  const port = await listen(receiver)
  const runtimeEnv = {
    FLOWMARK_API_KEY: "synthetic-write-key",
    FLOWMARK_API_URL: `http://127.0.0.1:${port}`,
  }
  await run("pnpm", ["--filter", "@flowmarkdev/core", "build"])
  // This command owns SDK build outputs (watchers must be stopped). Pack a
  // clean build so removed implementation files cannot survive in the tarball.
  await rm(join(root, "packages/sdk/dist"), { recursive: true, force: true })
  await run("pnpm", ["--filter", "@flowmarkdev/node", "build"])
  await run("pnpm", [
    "--filter",
    "@flowmarkdev/core",
    "pack",
    "--pack-destination",
    directory,
  ])
  await run("pnpm", [
    "--filter",
    "@flowmarkdev/node",
    "pack",
    "--pack-destination",
    directory,
  ])
  const tarballs = await readdir(directory)
  const core = join(
    directory,
    tarballs.find(
      (name) => name.startsWith("flowmarkdev-core-") && name.endsWith(".tgz"),
    ),
  )
  const sdk = join(
    directory,
    tarballs.find(
      (name) => name.startsWith("flowmarkdev-node-") && name.endsWith(".tgz"),
    ),
  )
  await cp(join(root, "packages/sdk/fixtures/consumer"), consumer, {
    recursive: true,
  })
  const version = async (name) =>
    JSON.parse(
      await readFile(
        join(root, `apps/server/node_modules/${name}/package.json`),
        "utf8",
      ),
    ).version
  await writeFile(
    join(consumer, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: {
        "@flowmarkdev/core": `file:${core}`,
        "@flowmarkdev/node": `file:${sdk}`,
        next: await version("next"),
        react: await version("react"),
        "react-dom": await version("react-dom"),
      },
      pnpm: { overrides: { "@flowmarkdev/core": `file:${core}` } },
    }),
  )
  await writeFile(
    join(consumer, "next.config.mjs"),
    "export default { experimental: { cpus: 2 } }\n",
  )
  await run(
    "pnpm",
    ["install", "--prefer-offline", "--ignore-scripts"],
    consumer,
    {
      ...environment,
      NODE_ENV: "development",
    },
  )
  const manifest = JSON.parse(
    await readFile(
      join(consumer, "node_modules/@flowmarkdev/node/package.json"),
      "utf8",
    ),
  )
  assert.ok(!JSON.stringify(manifest).includes("workspace:"))
  const sourceManifest = JSON.parse(
    await readFile(join(root, "packages/sdk/package.json"), "utf8"),
  )
  const installedCore = JSON.parse(
    await readFile(
      join(consumer, "node_modules/@flowmarkdev/core/package.json"),
      "utf8",
    ),
  )
  assert.equal(manifest.version, sourceManifest.version)
  assert.equal(installedCore.version, manifest.version)
  assert.equal(
    manifest.dependencies["@flowmarkdev/core"],
    installedCore.version,
  )
  await Promise.all(
    Object.values(manifest.exports).map(async (exported) => {
      await Promise.all(
        (typeof exported === "string"
          ? [exported]
          : Object.values(exported)
        ).map((file) =>
          readFile(join(consumer, "node_modules/@flowmarkdev/node", file)),
        ),
      )
    }),
  )
  // Compile the actual served guide, not a separately maintained copy. Only
  // supply application helpers and resolve the example's application aliases.
  const snippets = [
    ...instrumentationGuide(runtimeEnv.FLOWMARK_API_URL).matchAll(
      /```ts\n([\s\S]*?)```/g,
    ),
  ].map(([, code]) => code)
  assert.equal(snippets.length, 3)
  const [business, route] = snippets[1].split("// app/api/import/route.ts\n")
  await writeFile(join(consumer, "guide-client.ts"), snippets[0])
  await writeFile(
    join(consumer, "guide-business.ts"),
    `${business}\ndeclare function loadInvoices(): Promise<unknown[]>\ndeclare function saveInvoices(invoices: unknown[]): Promise<{ imported: number; rejected: number }>\n`,
  )
  await writeFile(
    join(consumer, "guide-route.ts"),
    route
      .replaceAll("@/lib/flowmark", "./guide-client.js")
      .replaceAll("@/business/import-invoices", "./guide-business.js"),
  )
  await writeFile(
    join(consumer, "guide-script.ts"),
    snippets[2].replaceAll("./business/import-invoices", "./guide-business.js"),
  )
  await run(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--module",
      "NodeNext",
      "--target",
      "ES2022",
      "public-types.ts",
      "guide-client.ts",
      "guide-business.ts",
      "guide-route.ts",
      "guide-script.ts",
    ],
    consumer,
  )
  console.log(
    "PASS packed manifests, public exports, declaration consumer and actual served guide examples",
  )
  const buildArgs = [join(consumer, "node_modules/next/dist/bin/next"), "build"]
  try {
    await run(process.execPath, buildArgs, consumer)
  } catch (error) {
    // Next may stop once after an upgrade advisory and explicitly require the
    // exact command again. Keep the diagnostic visible, preserve its retry
    // receipt, and repeat once. A persistent build failure still fails the test.
    console.error(error.message)
    console.log(
      "Repeating the same Next build once; the first failure is recorded above.",
    )
    await run(process.execPath, buildArgs, consumer)
  }
  assert.equal(received.length, 0)
  console.log(
    "PASS real Next production build/prerender without credentials or telemetry",
  )
  const missing = await start({})
  assert.equal(
    (await fetch(`${missing}/api/import`, { method: "POST", body: "{}" }))
      .status,
    500,
  )
  assert.equal(received.length, 0)
  await eventually(
    () => logs.includes("Set FLOWMARK_API_KEY"),
    "visible runtime configuration error",
  )
  await stop()
  const origin = await start(runtimeEnv)
  const post = async (body) => {
    const response = await fetch(`${origin}/api/import`, {
      method: "POST",
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }
  const results = await Promise.all([
    post({ mode: "complete" }),
    post({ mode: "partial" }),
    post({ mode: "failure" }),
  ])
  assert.deepEqual(
    results.map((result) => result.status),
    [200, 200, 500],
  )
  await eventually(
    () =>
      results.every(({ body }) =>
        eventsFor(body.runId).some((event) =>
          ["completed", "failed"].includes(event.type),
        ),
      ),
    "automatic Next after drains",
  )
  assert.equal(new Set(results.map((result) => result.body.runId)).size, 3)
  results.forEach(({ body }, index) => {
    const events = eventsFor(body.runId)
    // A transport retry retains the exact envelope instead of creating an execution.
    const unique = [
      ...new Map(
        events.map((event) => [JSON.stringify(event), event]),
      ).values(),
    ]
    assert.deepEqual(
      unique.map((event) => event.type),
      [
        "started",
        "step",
        "operation_started",
        index === 2 ? "operation_failed" : "operation_completed",
        index === 2 ? "failed" : "completed",
      ],
    )
  })
  assert.equal(eventsFor(results[1].body.runId).at(-1).outcome, "partial")
  assert.deepEqual(eventsFor(results[1].body.runId).at(-1).result, {
    imported: 8,
    rejected: 2,
  })
  assert.equal(
    eventsFor(results[2].body.runId).at(-1).failure.code,
    "IMPORT_FAILED",
  )
  const retry = await post({
    retryOf: { workflow: "consumer.import", runId: results[2].body.runId },
  })
  await eventually(
    () =>
      eventsFor(retry.body.runId).some((event) => event.type === "completed"),
    "new execution attempt",
  )
  assert.notEqual(retry.body.runId, results[2].body.runId)
  assert.deepEqual(eventsFor(retry.body.runId)[0].retryOf, {
    workflow: "consumer.import",
    runId: results[2].body.runId,
  })
  assert.deepEqual(
    received.filter((envelope) => envelope.eventId === retryEnvelope.eventId),
    [retryEnvelope, retryEnvelope],
  )
  console.log(
    "PASS concurrent Route Handlers, completion, failure, partial outcomes and distinct retry executions",
  )
  assert.equal(
    (await fetch(`${origin}/api/background`, { method: "POST" })).status,
    200,
  )
  await eventually(
    () =>
      received.some(
        ({ event }) =>
          event.workflow === "consumer.background" &&
          event.type === "completed",
      ),
    "instrumentation inside application after()",
  )
  const actionPage = await (await fetch(`${origin}/actions`)).text()
  const actionId = actionPage.match(/name="\$ACTION_ID_([^"]+)"/)?.[1]
  assert.ok(actionId, "real Server Action form id")
  const form = new FormData()
  form.set(`$ACTION_ID_${actionId}`, "")
  assert.equal(
    (
      await fetch(`${origin}/actions`, {
        method: "POST",
        body: form,
        headers: { origin },
      })
    ).status,
    200,
  )
  await eventually(
    () =>
      received.some(
        ({ event }) =>
          event.workflow === "consumer.action" && event.type === "completed",
      ),
    "Server Action automatic delivery",
  )
  console.log(
    "PASS real Server Action and application-owned after() background work",
  )
  await stop()
  const rejecting = await start({
    ...runtimeEnv,
    FLOWMARK_API_KEY: "synthetic-rejected",
  })
  const response = await fetch(`${rejecting}/api/import`, {
    method: "POST",
    body: "{}",
  })
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).result, {
    imported: 10,
    rejected: 0,
  })
  await eventually(
    () => logs.includes("Workflow delivery failed"),
    "visible after drain failure",
  )
  await stop()
  console.log(
    "PASS Next delivery failure preserves response and emits diagnostics",
  )
  const beforeMissingNodeKey = received.length
  await assert.rejects(
    run(process.execPath, ["node-script.mjs"], consumer),
    /Set FLOWMARK_API_KEY/,
  )
  assert.equal(received.length, beforeMissingNodeKey)
  assert.match(
    await run(process.execPath, ["node-script.mjs"], consumer, {
      ...environment,
      ...runtimeEnv,
    }),
    /node-consumer-ok/,
  )
  assert.deepEqual(
    received
      .filter(({ event }) => event.workflow === "consumer.open")
      .map(({ event }) => event.type),
    ["started", "operation_started"],
  )
  assert.match(
    await run(
      process.execPath,
      ["node-script.mjs", "--reject-delivery"],
      consumer,
      { ...environment, ...runtimeEnv, FLOWMARK_API_KEY: "synthetic-rejected" },
    ),
    /node-consumer-ok/,
  )
  console.log(
    "PASS standalone Node script, original application error, flush/reuse, shutdown/idempotency and failed delivery",
  )
  const operationFailures = received.filter(
    ({ event }) => event.type === "operation_failed",
  )
  assert.ok(operationFailures.length > 0)
  operationFailures.forEach(({ event }) =>
    assert.deepEqual(event.failure, { code: "operation_failed" }),
  )
  assert.ok(
    !JSON.stringify(received).includes("SYNTHETIC_PRIVATE_PROVIDER_DETAIL"),
  )
  console.log(
    "PASS Node and Next default failure privacy through real HTTP, preserving application errors",
  )
} finally {
  await stop()
  receiver.closeAllConnections()
  await new Promise((resolve) => receiver.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
