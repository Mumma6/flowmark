import { AsyncLocalStorage } from "node:async_hooks"
import { Array, Effect, Result } from "effect"
import { createFlowmarkWithTransport, MemoryTransport } from "../src/index.js"
import {
  captureTraceProperties,
  traceOperationOptions,
  type TraceReference,
} from "../examples/trace-context/recipe.js"

export const syntheticSpans = [
  {
    traceId: "11111111111111111111111111111111",
    spanId: "1111111111111111",
    serviceName: "booking-api",
    name: "reserve inventory",
    // Technical success does not determine the business outcome below.
    status: "ok",
  },
  {
    traceId: "22222222222222222222222222222222",
    spanId: "2222222222222222",
    serviceName: "booking-api",
    name: "request confirmation",
    status: "ok",
  },
  {
    traceId: "33333333333333333333333333333333",
    spanId: "3333333333333333",
    serviceName: "booking-api",
    name: "confirm later request",
    status: "ok",
  },
] as const

/** Only an owned synthetic fixture, never a URL or tracing provider lookup. */
export const resolveSyntheticSpan = (reference: TraceReference) =>
  Array.findFirst(
    syntheticSpans,
    (span) =>
      span.traceId === reference.traceId &&
      span.spanId === reference.spanId &&
      span.serviceName === reference.serviceName,
  )

export const runTraceContextProof = Effect.fn("TraceContext.syntheticProof")(
  function* () {
    const transport = new MemoryTransport()
    const client = yield* Effect.acquireRelease(
      Effect.sync(() => createFlowmarkWithTransport({ transport })),
      (client) => Effect.promise(() => client.shutdown()),
    )
    // This represents the app's already-configured context reader, not an SDK manager.
    const active = new AsyncLocalStorage<TraceReference>()
    const read = () => active.getStore()
    const initialProperties = captureTraceProperties(
      () => syntheticSpans[0],
      "booking-api",
    ).pipe(Result.getOrThrow)
    const flow = client.workflow("booking.trace-proof", {
      id: "synthetic-booking",
      correlationId: "synthetic-order",
      parentRunId: "synthetic-parent",
      properties: initialProperties,
    })
    const values = yield* Effect.forEach(
      Array.take(syntheticSpans, 2),
      (span) =>
        Effect.promise(() =>
          active.run(span, async () => {
            // Resume after an async hop, as an already-instrumented app would.
            await Promise.resolve()
            return flow.operation(
              span.name,
              () => Promise.resolve(span.name),
              traceOperationOptions(read, "booking-api"),
            )
          }),
        ),
      { concurrency: 2 },
    )
    // A later request continues the same run; start metadata is not amended.
    const continued = client.workflow("booking.trace-proof", {
      id: flow.runId,
    })
    yield* Effect.promise(() =>
      active.run(syntheticSpans[2], () =>
        continued.operation(
          "confirm later request",
          () => Promise.resolve("no-availability"),
          traceOperationOptions(read, "booking-api"),
        ),
      ),
    )
    continued.done({
      outcome: "partial",
      result: { confirmed: 0, requested: 2 },
    })
    yield* Effect.promise(() => client.shutdown())
    return { events: transport.events, values, runId: flow.runId }
  },
)
