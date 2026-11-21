import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { availableParallelism, cpus, totalmem } from "node:os"
import { join } from "node:path"
import { performance } from "node:perf_hooks"

const modes = ["sdk", "operation", "capture", "trace"]
const concurrency = 8
const warmups = 8
const measured = 128

const trial = (mode) => ({ id: randomUUID(), mode })
const rounded = (value) => Number(value.toFixed(2))
const percentiles = (values) => {
  const sorted = [...values].sort((left, right) => left - right)
  const at = (p) => rounded(sorted[Math.ceil(p * sorted.length) - 1])
  return { p95Ms: at(0.95), p99Ms: at(0.99) }
}

export async function runCaptureBenchmark({
  consumer,
  start,
  stop,
  eventsFor,
  eventually,
  captureBatches,
  setUnavailable,
  runNode,
}) {
  const receipt = (input) => {
    const trace = eventsFor(input.id).find((event) => event.type === "started")
      ?.properties?.traceContext
    return captureBatches.find(
      ({ envelope }) =>
        envelope.runId === input.id ||
        (trace &&
          envelope.resourceSpans?.[0].scopeSpans[0].spans[0]?.traceId ===
            trace.traceId),
    )
  }
  const call = async (origin, input) => {
    const response = await fetch(origin + "/api/capture-probe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    })
    assert.equal(response.status, 200)
    return response.json()
  }
  const verify = async (inputs, results) => {
    results.forEach((result) =>
      assert.deepEqual(result.result, { imported: 2 }),
    )
    await eventually(
      () =>
        inputs.every((input) => {
          const events = eventsFor(input.id)
          return (
            events.some((event) => event.type === "completed") &&
            (!["capture", "trace"].includes(input.mode) || receipt(input))
          )
        }),
      "capture probe evidence",
    )
    return inputs.map((input) => {
      const events = eventsFor(input.id)
      const batch = receipt(input)
      const serialized = JSON.stringify({ events, batch })
      assert(!serialized.includes("SYNTHETIC_PRIVATE"))
      assert.equal(events.length, input.mode === "operation" ? 4 : 2)
      assert.deepEqual(
        events.find((event) => event.type === "completed")?.result,
        { imported: 2 },
      )
      if (input.mode === "operation") {
        assert(
          events.some(
            (event) =>
              event.type === "operation_failed" &&
              event.failure?.code === "RATE_LIMITED",
          ),
        )
      }
      if (input.mode === "capture") {
        assert.deepEqual(
          batch.envelope.records.map(({ dependency, status }) => ({
            dependency,
            status,
          })),
          [
            { dependency: "primary", status: 429 },
            { dependency: "fallback", status: 200 },
          ],
        )
        assert.equal(batch.envelope.dropped, Number(Boolean(input.overflow)))
        assert(batch.bytes <= 256)
      }
      if (input.mode === "trace") {
        const reference = events.find((event) => event.type === "started")
          .properties.traceContext
        const [{ resource, scopeSpans }] = batch.envelope.resourceSpans
        const [root, ...children] = scopeSpans[0].spans
        assert.equal(root.traceId, reference.traceId)
        assert.equal(root.spanId, reference.spanId)
        assert.equal(
          resource.attributes[0].value.stringValue,
          reference.serviceName,
        )
        assert.deepEqual(
          children.map((span) => span.attributes[0].value.intValue),
          ["429", "200"],
        )
      }
      return batch?.bytes ?? 0
    })
  }

  const rows = []
  for (const runtime of ["node", "next"]) {
    for (const mode of modes) {
      const coldStart = performance.now()
      const origin = runtime === "next" ? await start() : undefined
      const cold = [trial(mode)]
      const coldResult = origin
        ? [await call(origin, cold[0])]
        : await runNode(cold)
      const coldMs = rounded(performance.now() - coldStart)
      await verify(cold, coldResult)
      const inputs = Array.from({ length: warmups + measured }, () =>
        trial(mode),
      )
      const results = []
      if (origin) {
        for (let offset = 0; offset < inputs.length; offset += concurrency) {
          results.push(
            ...(await Promise.all(
              inputs
                .slice(offset, offset + concurrency)
                .map((input) => call(origin, input)),
            )),
          )
        }
      } else {
        results.push(...(await runNode(inputs)))
      }
      const bytes = await verify(inputs, results)
      const sample = results.slice(warmups)
      rows.push({
        runtime,
        mode,
        coldMs,
        ...percentiles(sample.map((result) => result.elapsedMs)),
        sampledPeakRssMiB: rounded(
          Math.max(...sample.map((result) => result.rss)) / 2 ** 20,
        ),
        maxTechnicalBytesPerRun: Math.max(...bytes),
        technicalRecords:
          mode === "capture"
            ? measured * 2
            : mode === "trace"
              ? measured * 3
              : 0,
      })
      if (origin) await stop()
    }
  }
  const overflow = [{ ...trial("capture"), overflow: true }]
  await verify(overflow, await runNode(overflow))
  const outage = [trial("capture")]
  setUnavailable(true)
  try {
    const results = await runNode(outage)
    await verify(outage, results)
    assert.equal(results[0].delivery, "known-drop")
    assert.equal(receipt(outage[0]).accepted, false)
  } finally {
    setUnavailable(false)
  }

  const next = JSON.parse(
    await readFile(join(consumer, "node_modules/next/package.json"), "utf8"),
  ).version
  const sdk = JSON.parse(
    await readFile(
      join(consumer, "node_modules/@flowmarkdev/node/package.json"),
      "utf8",
    ),
  ).version
  console.log(
    "CAPTURE BENCHMARK",
    JSON.stringify(
      {
        node: process.version,
        undici: process.versions.undici,
        next,
        sdk,
        hardware: {
          model: cpus()[0]?.model,
          logicalCores: availableParallelism(),
          ramGiB: totalmem() / 2 ** 30,
        },
        warmups,
        samples: measured,
        concurrency,
        budget: {
          incrementalWarmP95Ms: 1,
          incrementalWarmP99Ms: 3,
          incrementalPeakRssMiB: 16,
          curatedBytesPerRun: 256,
          curatedRecordsPerRun: 2,
        },
        rows,
        verified: [
          "equal application results",
          "distinct SDK and technical evidence",
          "parallel attribution",
          "coexistence with an independent Node diagnostics subscriber",
          "one known capped record",
          "one known failed delivery",
          "selected wire fields only",
        ],
        limits: [
          "OTLP/HTTP JSON fixture sink, no Collector process",
          "ephemeral technical evidence, no database",
          "single cold observation per mode",
          "RSS sampled at workflow completion",
        ],
      },
      null,
      2,
    ),
  )
}
