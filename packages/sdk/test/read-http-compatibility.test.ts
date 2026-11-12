import { createServer, type Server, type RequestListener } from "node:http"
import { Readable } from "node:stream"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterAll, beforeAll, expect, it } from "vitest"
import { createFlowmarkReadClient } from "../src/reads/index.js"

const input = {
  version: 1,
  kind: "run",
  section: "events",
  projectId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
  limit: 7,
  cursor:
    "2026-11-10T00:00:00.123456Z|2026-11-10T00:00:01.123456Z|00000000-0000-4000-8000-000000000003",
} as const

const listen = (server: Server): Promise<string> =>
  new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (!address || typeof address === "string") {
        return reject(new Error("Missing test port"))
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
let server: Server, target: Server, origin: string, targetOrigin: string
let status = 401,
  code = "UNAUTHORIZED",
  redirects = false,
  targetCalls = 0
const requests: {
  path: string | undefined
  body: unknown
  authorization: string | undefined
  cookie: string | undefined
}[] = []

beforeAll(async () => {
  target = createServer((_request, response) => {
    targetCalls++
    response.end("unexpected")
  })
  targetOrigin = await listen(target)
  const handler: RequestListener = async (request, response) => {
    const body: unknown = await new Response(
      Readable.toWeb(request) as ReadableStream<Uint8Array>,
    ).json()
    requests.push({
      path: request.url,
      body,
      authorization: request.headers.authorization,
      cookie: request.headers.cookie,
    })
    if (redirects) {
      response.writeHead(307, { Location: `${targetOrigin}/other` })
      response.end()
      return
    }
    response.writeHead(status, { "Content-Type": "application/json" })
    response.end(
      JSON.stringify({
        version: 1,
        error: {
          code,
          message: "PRIVATE_UPSTREAM_DETAIL",
          retryAfterSeconds: status === 429 ? 3 : null,
        },
      }),
    )
  }
  server = createServer(handler)
  origin = await listen(server)
})
afterAll(async () => {
  await Promise.all(
    [server, target].map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    ),
  )
})

it.each([
  [401, "UNAUTHORIZED"],
  [403, "PROJECT_FORBIDDEN"],
  [404, "RUN_NOT_FOUND"],
  [400, "UNSUPPORTED_VERSION"],
  [400, "UNSUPPORTED_SELECTION"],
  [400, "INVALID_CURSOR"],
  [422, "EVIDENCE_TOO_LARGE"],
  [429, "RATE_LIMITED"],
  [503, "READ_UNAVAILABLE"],
  [504, "READ_TIMEOUT"],
  [409, "FUTURE_SERVER_CODE"],
] as const)(
  "preserves HTTP %i / %s without retrying or widening the question",
  async (httpStatus, errorCode) => {
    status = httpStatus
    code = errorCode
    redirects = false
    const before = requests.length
    const client = createFlowmarkReadClient({
      apiBaseUrl: `${origin}/self-host`,
      readKey: "fm_read_synthetic",
    })
    await expect(client.readRun(input)).rejects.toMatchObject({
      code: errorCode,
      status: httpStatus,
      retryAfterSeconds: httpStatus === 429 ? 3 : null,
      message: `Flowmark read failed: ${errorCode}.`,
    })
    expect(requests.length).toBe(before + 1)
    expect(requests.at(-1)).toEqual({
      path: "/self-host/v1/read/run",
      body: input,
      authorization: "Bearer fm_read_synthetic",
      cookie: undefined,
    })
  },
)

it("does not forward a secret to a redirected origin", async () => {
  redirects = true
  const before = requests.length
  await expect(
    createFlowmarkReadClient({
      apiBaseUrl: origin,
      readKey: "fm_read_synthetic",
    }).readRun(input),
  ).rejects.toMatchObject({ code: "NETWORK_ERROR", status: null })
  expect(requests.length).toBe(before + 1)
  expect(targetCalls).toBe(0)
})

it("makes no HTTP request when cancellation precedes the read", async () => {
  const controller = new AbortController()
  controller.abort()
  const before = requests.length
  await expect(
    createFlowmarkReadClient({
      apiBaseUrl: origin,
      readKey: "fm_read_synthetic",
    }).readRun(input, { signal: controller.signal }),
  ).rejects.toMatchObject({ code: "ABORTED", status: null })
  expect(requests.length).toBe(before)
})

it.each([undefined, null])(
  "reports missing JavaScript configuration as denied authority before HTTP",
  async (readKey) => {
    const before = requests.length
    const client = createFlowmarkReadClient({
      apiBaseUrl: origin,
      // @ts-expect-error Exercise untyped JavaScript/environment callers.
      readKey,
    })
    await expect(client.readRun(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: null,
    })
    expect(requests.length).toBe(before)
  },
)

it("prints an explicit CLI error for an unsupported period cursor without sending a widened read", async () => {
  const directory = await mkdtemp(join(tmpdir(), "flowmark-read-compat-"))
  const file = join(directory, "selection.json")
  await writeFile(
    file,
    JSON.stringify({
      version: 1,
      kind: "period",
      projectId: input.projectId,
      workflow: "test",
      currentStartedAfter: "2026-11-01T00:00:00.000Z",
      currentStartedBefore: "2026-11-08T00:00:00.000Z",
      previousStartedAfter: "2026-10-25T00:00:00.000Z",
      previousStartedBefore: "2026-11-01T00:00:00.000Z",
    }),
  )
  const before = requests.length
  try {
    await expect(
      promisify(execFile)(
        "pnpm",
        [
          "--filter",
          "@flowmark/db",
          "exec",
          "tsx",
          "--tsconfig",
          "../../examples/tsconfig.json",
          "../../examples/read-run.ts",
          file,
          "unsupported-cursor",
        ],
        {
          cwd: fileURLToPath(new URL("../../../", import.meta.url)),
          env: {
            ...process.env,
            FLOWMARK_API_URL: origin,
            FLOWMARK_READ_KEY: "fm_read_synthetic",
          },
        },
      ),
    ).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining("UNSUPPORTED_SELECTION"),
    })
    expect(requests.length).toBe(before)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 15000)
