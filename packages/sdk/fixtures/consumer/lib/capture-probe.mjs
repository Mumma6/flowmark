import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { channel } from "node:diagnostics_channel"
import { performance } from "node:perf_hooks"
import process from "node:process"

const scope = new AsyncLocalStorage()
const requests = new WeakMap()
const paths = new Map([
  ["/capture-fixture/primary", "primary"],
  ["/capture-fixture/fallback", "fallback"],
])
const create = channel("undici:request:create")
const headers = channel("undici:request:headers")
const error = channel("undici:request:error")
const maxRecords = 2
let subscribed = false

function observe() {
  if (subscribed) return
  subscribed = true
  create.subscribe(({ request }) => {
    const active = scope.getStore()
    if (
      !active ||
      request?.origin !== active.origin ||
      typeof request.path !== "string"
    )
      return
    const dependency = paths.get(request.path.split("?")[0])
    if (dependency)
      requests.set(request, { active, dependency, start: performance.now() })
  })
  const record = (request, status) => {
    const pending = requests.get(request)
    if (!pending) return
    requests.delete(request)
    const { active, dependency, start } = pending
    if (active.records.length === maxRecords) {
      active.dropped++
      return
    }
    active.records.push({
      dependency,
      status,
      durationMs: Math.round(performance.now() - start),
    })
  }
  headers.subscribe(({ request, response }) =>
    record(request, response.statusCode),
  )
  error.subscribe(({ request }) => record(request, "transport-error"))
}

const probeModes = ["sdk", "operation", "capture", "trace"]

const unixNanos = () => (BigInt(Date.now()) * 1_000_000n).toString()

export async function runCaptureProbe(
  flowmark,
  { mode, id, overflow = false },
) {
  if (!probeModes.includes(mode)) throw new Error("Unknown fixture mode")
  const { origin, hostname } = new URL(process.env.FLOWMARK_API_URL)
  if (hostname !== "127.0.0.1")
    throw new Error("Capture fixture requires loopback")
  const before = performance.now()
  if (mode === "capture") observe()
  const active = { origin, records: [], dropped: 0 }
  const traceId = randomUUID().replaceAll("-", "")
  const spanId = traceId.slice(0, 16)
  const trace = { traceId, spanId, serviceName: "fixture-import" }
  const rootStart = unixNanos()
  const spans = []
  const runDependency = async (name) => {
    const startTimeUnixNano = mode === "trace" ? unixNanos() : undefined
    const response = await fetch(
      origin + "/capture-fixture/" + name + "?account=SYNTHETIC_PRIVATE_QUERY",
      {
        cache: "no-store",
        headers: { authorization: "Bearer SYNTHETIC_PRIVATE_HEADER" },
      },
    )
    const result = await response.json()
    if (startTimeUnixNano) {
      spans.push({
        traceId,
        spanId: randomUUID().replaceAll("-", "").slice(0, 16),
        parentSpanId: spanId,
        name,
        startTimeUnixNano,
        endTimeUnixNano: unixNanos(),
        attributes: [
          {
            key: "http.response.status_code",
            value: { intValue: String(response.status) },
          },
        ],
      })
    }
    if (!response.ok) {
      const failure = new Error("Synthetic dependency rejected the request")
      failure.code = response.status === 429 ? "RATE_LIMITED" : "UNAVAILABLE"
      throw failure
    }
    return result
  }
  const run = () =>
    flowmark.workflow(
      "capture-fixture.import",
      async (flow) => {
        let result
        try {
          const primary = () => runDependency("primary")
          result = await (mode === "operation"
            ? flow.operation("primary provider", primary, {
                mapError: (failure) => ({
                  code:
                    failure?.code === "RATE_LIMITED"
                      ? "RATE_LIMITED"
                      : "UNAVAILABLE",
                }),
              })
            : primary())
        } catch (failure) {
          if (failure.code !== "RATE_LIMITED") throw failure
          result = await runDependency("fallback")
          if (overflow) await runDependency("fallback")
        }
        flow.done({ result })
        return result
      },
      {
        id,
        ...(mode === "trace" ? { properties: { traceContext: trace } } : {}),
      },
    )
  const result = await (mode === "capture" ? scope.run(active, run) : run())
  return {
    result,
    elapsedMs: performance.now() - before,
    rss: process.memoryUsage.rss(),
    export:
      mode === "capture"
        ? {
            kind: "curated",
            runId: id,
            records: active.records,
            dropped: active.dropped,
          }
        : mode === "trace"
          ? {
              resourceSpans: [
                {
                  resource: {
                    attributes: [
                      {
                        key: "service.name",
                        value: { stringValue: trace.serviceName },
                      },
                    ],
                  },
                  scopeSpans: [
                    {
                      scope: { name: "capture-fixture" },
                      spans: [
                        {
                          traceId,
                          spanId,
                          name: "import",
                          startTimeUnixNano: rootStart,
                          endTimeUnixNano: unixNanos(),
                        },
                        ...spans,
                      ],
                    },
                  ],
                },
              ],
            }
          : null,
  }
}

// One bounded export attempt. The caller controls its lifetime and receives the local result.
export async function sendCaptureProbe(origin, evidence) {
  if (!evidence) return "none"
  const body = JSON.stringify(evidence)
  const trace = "resourceSpans" in evidence
  if (Buffer.byteLength(body) > (trace ? 2048 : 256)) return "over-budget"
  try {
    const response = await fetch(
      origin + (trace ? "/v1/traces" : "/capture-fixture/observations"),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(250),
      },
    )
    return response.ok ? "received" : "known-drop"
  } catch {
    return "known-drop"
  }
}
