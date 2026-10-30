import {
  HttpClient,
  HttpClientResponse,
  type HttpClientRequest,
} from "effect/http"
import {
  Context,
  Deferred,
  Effect,
  Result,
  Layer,
  Redacted,
  Semaphore,
} from "effect"
import { describe, expect, it, vi } from "vitest"
import type { WorkflowEvent, WorkflowProperties } from "@flowmarkdev/core"
import { HttpTransportLive } from "../src/delivery/adapters/http.js"
import { FlowmarkSettings } from "../src/config/settings.js"
import { DeliveryQueue } from "../src/delivery/delivery-queue.js"
import { WorkflowTransport } from "../src/delivery/ports/workflow-transport.js"
import { WorkflowEngine } from "../src/workflows/workflow-engine.js"
import { WorkflowEvents } from "../src/workflows/workflow-events.js"
import { WorkflowRuns } from "../src/workflows/run-lifecycle.js"

const event: WorkflowEvent = {
  type: "started",
  workflow: "service-test",
  runId: "test-run",
  timestamp: "2026-01-01T00:00:00.000Z",
}

function httpLayer(client: HttpClient.HttpClient) {
  return HttpTransportLive.pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
    Layer.provide(
      Layer.succeed(FlowmarkSettings, {
        apiKey: Redacted.make("injected-key"),
        apiUrl: "http://localhost:3003",
      }),
    ),
  )
}

describe("workflow delivery feature", () => {
  it("keeps HTTP lazy, uses the injected client, and releases its request scope", async () => {
    const requests: HttpClientRequest.HttpClientRequest[] = []
    const signals: AbortSignal[] = []
    const client = HttpClient.make((request, _url, signal) =>
      Effect.sync(() => {
        requests.push(request)
        signals.push(signal)
        return HttpClientResponse.fromWeb(
          request,
          new Response(null, { status: 202 }),
        )
      }),
    )
    const operation = Effect.flatMap(WorkflowTransport, (transport) =>
      transport.emit(event),
    ).pipe(Effect.provide(httpLayer(client)))

    expect(requests).toHaveLength(0)
    await Effect.runPromise(operation)
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe("http://localhost:3003/v1/events")
    expect(requests[0].method).toBe("POST")
    expect(requests[0].headers.authorization).toBe("Bearer injected-key")
    expect(signals[0].aborted).toBe(true)
  })

  it("preserves HTTP status and original cause without retrying unauthorized requests", async () => {
    const execute = vi.fn((request: HttpClientRequest.HttpClientRequest) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(null, { status: 401 }),
        ),
      ),
    )
    const result = await Effect.runPromise(
      Effect.flatMap(WorkflowTransport, (transport) =>
        Effect.result(transport.emit(event)),
      ).pipe(Effect.provide(httpLayer(HttpClient.make(execute)))),
    )
    Result.match(result, {
      onFailure: (error) =>
        expect(error).toMatchObject({
          _tag: "FlowmarkHttpError",
          status: 401,
          cause: {
            _tag: "HttpClientError",
            reason: { _tag: "StatusCodeError" },
          },
        }),
      onSuccess: () => expect.fail("expected an unauthorized HTTP failure"),
    })
    expect(execute).toHaveBeenCalledOnce()
  })

  it("reports encoding failures without making HTTP requests", async () => {
    const execute = vi.fn((request: HttpClientRequest.HttpClientRequest) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(
          request,
          new Response(null, { status: 202 }),
        ),
      ),
    )
    const properties: WorkflowProperties = { circular: [] }
    const circular = properties.circular
    if (!Array.isArray(circular)) {
      throw new Error("Expected a mutable JSON array")
    }
    circular.push(circular)
    const result = await Effect.runPromise(
      Effect.flatMap(WorkflowTransport, (transport) =>
        Effect.result(transport.emit({ ...event, properties })),
      ).pipe(Effect.provide(httpLayer(HttpClient.make(execute)))),
    )
    Result.match(result, {
      onFailure: (error) =>
        expect(error).toMatchObject({ _tag: "FlowmarkHttpError" }),
      onSuccess: () => expect.fail("expected an encoding failure"),
    })
    expect(execute).not.toHaveBeenCalled()
  })

  it("bounds pending delivery and surfaces overflow when draining the queue", async () => {
    const onError = vi.fn()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const gate = yield* Deferred.make<void>()
          const transport: WorkflowTransport = {
            emit: () => Deferred.await(gate),
          }
          const services = yield* Layer.build(
            DeliveryQueue.layer(onError).pipe(
              Layer.provide(Layer.succeed(WorkflowTransport, transport)),
            ),
          )
          const queue = Context.get(services, DeliveryQueue)
          const ordering = yield* Semaphore.make(1)
          yield* Effect.forEach(
            Array.from({ length: 1001 }),
            () => queue.enqueue(event, ordering),
            {
              concurrency: "unbounded",
              discard: true,
            },
          )
          expect(onError).toHaveBeenCalledOnce()
          yield* Deferred.succeed(gate, undefined)
          const result = yield* Effect.result(queue.shutdown)
          Result.match(result, {
            onFailure: (error) =>
              expect(error).toMatchObject({
                _tag: "FlowmarkDeliveryError",
                failures: [{ _tag: "FlowmarkQueueError", reason: "capacity" }],
              }),
            onSuccess: () => expect.fail("expected a bounded queue overflow"),
          })
        }),
      ),
    )
  })

  it("does not hide unexpected delivery defects from flush", async () => {
    const transport: WorkflowTransport = {
      emit: () => Effect.die("unexpected defect"),
    }
    const operation = Effect.gen(function* () {
      const queue = yield* DeliveryQueue
      yield* queue.enqueue(event, yield* Semaphore.make(1))
      return yield* Effect.result(queue.flush)
    }).pipe(
      Effect.provide(
        DeliveryQueue.layer(vi.fn()).pipe(
          Layer.provide(Layer.succeed(WorkflowTransport, transport)),
        ),
      ),
    )
    Result.match(await Effect.runPromise(operation), {
      onFailure: (error) =>
        expect(error).toMatchObject({
          failures: [{ _tag: "WorkflowTransportError" }],
        }),
      onSuccess: () => expect.fail("expected a delivery defect"),
    })
  })

  it("composes workflows against an injected delivery service", async () => {
    const events: WorkflowEvent[] = []
    const delivery = Layer.succeed(DeliveryQueue, {
      enqueue: (entry) =>
        Effect.sync(() => {
          events.push(entry)
        }),
      flush: Effect.void,
      shutdown: Effect.void,
    })
    const operation = Effect.gen(function* () {
      const engine = yield* WorkflowEngine
      const flow = yield* engine.start("injected", { id: "run-123" })
      yield* flow.step("saved")
      yield* flow.done()
      yield* flow.step("ignored")
      yield* flow.fail({ code: "ignored" })
    }).pipe(
      Effect.provide(
        WorkflowEngine.layer.pipe(
          Layer.provide(WorkflowRuns.layer),
          Layer.provide(WorkflowEvents.layer),
          Layer.provide(delivery),
        ),
      ),
    )

    expect(events).toHaveLength(0)
    await Effect.runPromise(operation)
    expect(events.map((entry) => entry.type)).toEqual([
      "started",
      "step",
      "completed",
    ])
    expect(events.every((entry) => entry.runId === "run-123")).toBe(true)
  })
})
