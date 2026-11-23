#!/usr/bin/env node
/** Build, pack and install the SDK into a real external Next.js/Node consumer.
 * No hosted service or credentials. Run with pnpm --filter @flowmarkdev/node test:consumer.
 */
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createServer } from "node:http"
import {
  cp,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { setTimeout as delay } from "node:timers/promises"
import { runCaptureBenchmark } from "./benchmark-capture.mjs"

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
      ![
        "DATABASE_URL",
        "TEST_DATABASE_URL",
        "NODE_ENV",
        "PORT",
        "PROVIDER_API_URL",
        "JOB_STATE_DIRECTORY",
        "CRON_SECRET",
      ].includes(key),
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
const captureBatches = []
let captureUnavailable = false
const completedBookings = new Set()
let retryEnvelope
let retrySent = false
const receiver = createServer(async (request, response) => {
  const provider = new URL(request.url, "http://127.0.0.1")
  if (
    request.method === "GET" &&
    provider.pathname.startsWith("/capture-fixture/")
  ) {
    const primary = provider.pathname === "/capture-fixture/primary"
    response.writeHead(primary ? 429 : 200, {
      "content-type": "application/json",
    })
    response.end(JSON.stringify(primary ? { limited: true } : { imported: 2 }))
    return
  }
  if (["/news", "/repositories", "/editor"].includes(provider.pathname)) {
    const jobId = provider.searchParams.get("jobId") ?? ""
    const attempt = Number(provider.searchParams.get("attempt"))
    response.setHeader("content-type", "application/json")
    if (
      (provider.pathname === "/repositories" && jobId.startsWith("partial-")) ||
      (provider.pathname === "/editor" &&
        jobId.startsWith("retry-") &&
        attempt === 1)
    ) {
      response
        .writeHead(503)
        .end(JSON.stringify({ error: "synthetic-provider-failure" }))
    } else {
      response.end(
        JSON.stringify(
          provider.pathname === "/editor"
            ? jobId.startsWith("partial-")
              ? { stories: 1, rejected: 1 }
              : { stories: 3, rejected: 0 }
            : Array.from(
                { length: provider.pathname === "/news" ? 2 : 1 },
                (_, index) => ({
                  id: `${provider.pathname}-${index}`,
                  title: "Synthetic article",
                }),
              ),
        ),
      )
    }
    return
  }
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const bytes = Buffer.concat(chunks)
  const envelope = JSON.parse(bytes.toString())
  if (
    provider.pathname === "/capture-fixture/observations" ||
    provider.pathname === "/v1/traces"
  ) {
    captureBatches.push({
      envelope,
      bytes: bytes.length,
      accepted: !captureUnavailable,
    })
    response
      .writeHead(captureUnavailable ? 503 : 200, {
        "content-type": "application/json",
      })
      .end("{}")
    return
  }
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
  // The continuation example deliberately submits a conflicting terminal.
  // This receiver checks delivery contracts; it is not a hosted API substitute.
  if (
    envelope.event.workflow === "booking.create" &&
    ["completed", "failed"].includes(envelope.event.type)
  ) {
    if (completedBookings.has(envelope.event.runId)) {
      response.writeHead(409).end()
      return
    }
    completedBookings.add(envelope.event.runId)
  }
  response.writeHead(202, { "content-type": "application/json" }).end(
    JSON.stringify({
      accepted: true,
      capabilities: [
        "attempts-v1",
        "expectations-v1",
        "runtime-observations-v1",
      ],
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
        tsx: JSON.parse(
          await readFile(
            join(root, "packages/db/node_modules/tsx/package.json"),
            "utf8",
          ),
        ).version,
      },
      devDependencies: {
        typescript: await version("typescript"),
        "@types/node": await version("@types/node"),
        "@types/react": await version("@types/react"),
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
  // Compile the actual served guide with a stand-in for the existing job.
  const guideDirectory = "guide"
  await mkdir(join(consumer, guideDirectory))
  const snippets = [
    ...instrumentationGuide(runtimeEnv.FLOWMARK_API_URL).matchAll(
      /```ts\n([\s\S]*?)```/g,
    ),
  ].map(([, code]) => code)
  assert.equal(snippets.length, 3)
  await writeFile(join(consumer, guideDirectory, "client.ts"), snippets[0])
  await writeFile(
    join(consumer, guideDirectory, "import-invoices.ts"),
    "export async function importInvoices() { return { imported: 2 } }\n",
  )
  await writeFile(
    join(consumer, guideDirectory, "route.ts"),
    `import { flowmark } from "./client.js"
import { importInvoices } from "./import-invoices.js"
export async function POST() {
${snippets[1]}
return Response.json(result)
}
`,
  )
  await writeFile(
    join(consumer, guideDirectory, "script.ts"),
    snippets[2].replaceAll("./import-invoices", "./import-invoices.js"),
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
      `${guideDirectory}/route.ts`,
      `${guideDirectory}/script.ts`,
    ],
    consumer,
  )
  console.log(
    "PASS packed manifests, public exports, declaration consumer and actual served guide examples",
  )
  await writeFile(
    join(consumer, "examples.tsconfig.json"),
    JSON.stringify({
      extends: join(root, "packages/config/typescript/base.json"),
      compilerOptions: {
        paths: {
          "@flowmarkdev/node": [
            join(consumer, "node_modules/@flowmarkdev/node/dist/index.d.ts"),
          ],
          "@flowmarkdev/node/next": [
            join(
              consumer,
              "node_modules/@flowmarkdev/node/dist/adapters/next.d.ts",
            ),
          ],
          "@flowmarkdev/node/read": [
            join(
              consumer,
              "node_modules/@flowmarkdev/node/dist/reads/index.d.ts",
            ),
          ],
          "@flowmark/evidence-view/public-read": [
            join(root, "packages/evidence-view/src/public-read.ts"),
          ],
        },
        types: ["node"],
        jsx: "react-jsx",
      },
      include: [
        join(root, "examples/**/*.ts"),
        join(root, "packages/sdk/examples/**/*.ts"),
      ],
    }),
  )
  await run(
    process.execPath,
    [
      join(root, "node_modules/typescript/bin/tsc"),
      "-p",
      "examples.tsconfig.json",
    ],
    consumer,
  )
  console.log(
    "PASS all TypeScript examples against packed SDK public declarations",
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
  const briefingEnvironment = {
    ...runtimeEnv,
    PROVIDER_API_URL: runtimeEnv.FLOWMARK_API_URL,
    CRON_SECRET: "synthetic-cron-key",
    JOB_STATE_DIRECTORY: join(directory, "briefing-http-state"),
  }
  const tsx = join(consumer, "node_modules/tsx/dist/cli.mjs")
  const cases = ["daily", "partial-daily", "retry-daily", "retry-daily"]
  const resultsFrom = async (entry, state) => {
    const results = []
    for (const jobId of cases) {
      try {
        const output = await run(
          process.execPath,
          [tsx, entry, jobId],
          consumer,
          {
            ...briefingEnvironment,
            JOB_STATE_DIRECTORY: join(directory, state),
          },
        )
        results.push({
          code: 0,
          result: JSON.parse(
            output
              .trim()
              .split("\n")
              .findLast((line) => line.startsWith("{")),
          ),
        })
      } catch (error) {
        assert.match(error.message, /briefing-unavailable/)
        results.push({ code: 1 })
      }
    }
    return results
  }
  const control = await resultsFrom("control/generate.ts", "briefing-control")
  const beforeBriefing = received.length
  assert.deepEqual(
    await resultsFrom("scripts/generate.ts", "briefing-cli"),
    control,
  )
  assert.deepEqual(
    control.map((value) => value.code),
    [0, 0, 1, 0],
  )
  const invalidState = join(directory, "invalid-state")
  await writeFile(invalidState, "synthetic file, not a directory")
  await assert.rejects(
    run(
      process.execPath,
      [tsx, "scripts/generate.ts", "prepare-failure"],
      consumer,
      { ...briefingEnvironment, JOB_STATE_DIRECTORY: invalidState },
    ),
    /briefing-unavailable/,
  )
  assert.ok(
    received.slice(beforeBriefing).some(({ event }) => event.type === "failed"),
  )
  const origin = await start(briefingEnvironment)
  const cron = async (
    jobId,
    authorization = `Bearer ${briefingEnvironment.CRON_SECRET}`,
  ) =>
    fetch(`${origin}/api/cron`, {
      method: "POST",
      headers: { authorization },
      body: JSON.stringify({ jobId }),
    })
  assert.equal((await cron("unauthorized", "invalid")).status, 401)
  for (const [index, jobId] of cases.entries()) {
    const response = await cron(jobId)
    assert.equal(response.status, control[index].code === 0 ? 200 : 503)
    if (response.ok)
      assert.deepEqual(await response.json(), control[index].result)
  }
  await eventually(
    () =>
      received
        .slice(beforeBriefing)
        .filter(
          ({ event }) =>
            event.workflow === "briefing.generate" &&
            ["completed", "failed"].includes(event.type),
        ).length === 9,
    "briefing CLI, preparation failure and scheduler request drains",
  )
  const briefingStarts = received
    .slice(beforeBriefing)
    .filter(
      ({ event }) =>
        event.workflow === "briefing.generate" && event.type === "started",
    )
  assert.equal(new Set(briefingStarts.map(({ event }) => event.runId)).size, 9)
  assert.ok(
    received
      .slice(beforeBriefing)
      .some(
        ({ event }) =>
          event.workflow === "briefing.generate" &&
          event.outcome === "partial" &&
          event.result.unavailableSources === 1,
      ),
  )
  console.log(
    "PASS independent briefing control vs CLI/cron: sources, partial outcome, fresh retry runs and preparation failure",
  )
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
  const observed = received.filter(
    ({ event }) =>
      event.type === "step" && event.observation?.kind === "observation",
  )
  const [nodeEvidence] = observed.filter(
    ({ event }) => event.workflow === "consumer.script",
  )
  const [nextEvidence] = observed.filter(
    ({ event }) => event.workflow === "consumer.background",
  )
  assert.ok(
    nodeEvidence && nextEvidence,
    "both packed entry points emit runtime observations",
  )
  assert.deepEqual(
    nodeEvidence.event.observation,
    nextEvidence.event.observation,
  )
  assert.equal(nodeEvidence.event.observation.references.length, 1)
  assert.match(
    nodeEvidence.event.observation.references[0].digest,
    /^hmac-sha256:[a-f0-9]{64}$/,
  )
  assert.ok(
    received.every(
      ({ event }) =>
        event.workflow !== "consumer.disabled-observation" ||
        !event.observation,
    ),
  )
  assert.ok(
    received.some(
      ({ event }) =>
        event.observation?.kind === "loss" && event.observation.count === 1,
    ),
  )
  assert.doesNotMatch(
    JSON.stringify(received),
    /SYNTHETIC_(REFERENCE_KEY|RAW_BOOKING_REFERENCE|UNDECLARED_REFERENCE)/,
  )
  console.log(
    "PASS packed Node and Next runtime observations, explicit loss and reference privacy",
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
  const scripts = (await readdir(join(root, "packages/sdk/examples"))).filter(
    (file) => file.endsWith(".mjs"),
  )
  await mkdir(join(consumer, "sdk-examples"))
  for (const file of scripts) {
    const source = await readFile(
      join(root, "packages/sdk/examples", file),
      "utf8",
    )
    await writeFile(
      join(consumer, "sdk-examples", file),
      source.replaceAll('"../dist/index.js"', '"@flowmarkdev/node"'),
    )
    await run(process.execPath, [`sdk-examples/${file}`], consumer, {
      ...environment,
      ...runtimeEnv,
    })
  }
  for (const mode of ["resolve", "cancel"]) {
    const reference = JSON.parse(
      (
        await run(
          process.execPath,
          ["sdk-examples/durable-expectations.mjs"],
          consumer,
          { ...environment, ...runtimeEnv },
        )
      ).trim(),
    )
    await run(
      process.execPath,
      ["sdk-examples/durable-expectations.mjs", mode],
      consumer,
      {
        ...environment,
        ...runtimeEnv,
        FLOWMARK_EXPECTATION_REFERENCE: JSON.stringify(reference),
      },
    )
  }
  console.log(
    `PASS all ${scripts.length} runnable SDK examples with packed exports, including expectation settlement modes`,
  )
  if (process.env.FLOWMARK_CAPTURE_BENCHMARK === "1") {
    await stop()
    await runCaptureBenchmark({
      consumer,
      start: () => start(runtimeEnv),
      stop,
      eventsFor,
      eventually,
      captureBatches,
      setUnavailable: (value) => {
        captureUnavailable = value
      },
      runNode: (trials) =>
        run(
          process.execPath,
          ["scripts/capture-probe.mjs", JSON.stringify(trials)],
          consumer,
          { ...environment, ...runtimeEnv },
        ).then(JSON.parse),
    })
  }
} finally {
  await stop()
  receiver.closeAllConnections()
  await new Promise((resolve) => receiver.close(resolve))
  await rm(directory, { recursive: true, force: true })
}
