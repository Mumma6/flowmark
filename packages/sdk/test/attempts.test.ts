import { Cause, Effect, Layer } from "effect"
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest"
import type {
  WorkflowAttempt,
  WorkflowRetryReference,
  WorkflowEvent,
} from "@flowmarkdev/core"
import { makeClient } from "../src/client/runtime.js"
import { WorkflowTransport } from "../src/delivery/ports/workflow-transport.js"
import {
  createFlowmark,
  FlowmarkDeliveryError,
  FlowmarkHttpError,
  WorkflowTransportError,
  workflow,
} from "../src/index.js"
import type { WorkflowAttempt as BrowserAttempt } from "../src/browser/index.js"
import type { WorkflowRetryReference as NextReference } from "../src/adapters/next.js"

afterEach(() => vi.unstubAllGlobals())
describe("application-owned attempt metadata", () => {
  it("keeps failed and successful occurrences, snapshots metadata and exports ordinary types", async () => {
    expectTypeOf<BrowserAttempt>().toEqualTypeOf<WorkflowAttempt>()
    expectTypeOf<NextReference>().toEqualTypeOf<WorkflowRetryReference>()
    const events: WorkflowEvent[] = []
    const client = makeClient(
      Layer.succeed(WorkflowTransport, {
        emit: (event) =>
          Effect.sync(() => {
            events.push(event)
          }),
      }),
    )
    const flow = client.workflow("crm.sync", {
      retryOf: { workflow: "crm.sync", runId: "earlier" },
    })
    const attempt = { groupId: "customer-batch", number: 1 }
    const first = flow.operation("push", { attempt })
    attempt.number = 999
    first.fail({ code: "CRM_UNAVAILABLE" })
    const result = await flow.operation("push", () => Promise.resolve(42), {
      attempt: { groupId: "customer-batch", number: 2 },
    })
    expectTypeOf(result).toEqualTypeOf<number>()
    flow.done({ outcome: "partial", result: { imported: 3, rejected: 1 } })
    await client.shutdown()
    expect(events[0]).toMatchObject({
      retryOf: { workflow: "crm.sync", runId: "earlier" },
    })
    expect(
      events.filter(
        (event) =>
          "operationId" in event && event.operationId === first.operationId,
      ),
    ).toMatchObject([
      {
        type: "operation_started",
        attempt: { groupId: "customer-batch", number: 1 },
      },
      {
        type: "operation_failed",
        attempt: { groupId: "customer-batch", number: 1 },
      },
    ])
    expect(
      events.filter((event) => event.type === "operation_completed"),
    ).toMatchObject([{ attempt: { number: 2 } }])
    expect(events.at(-1)).toMatchObject({
      type: "completed",
      outcome: "partial",
    })
  })
  it("supports advanced callbacks without owning retries", async () => {
    const events: WorkflowEvent[] = []
    const flow = workflow("booking.retry", {
      id: "new-booking-attempt",
      retryOf: { workflow: "booking.create", runId: "previous-booking" },
      transport: {
        emit: (event) =>
          Effect.sync(() => {
            events.push(event)
          }),
      },
    })
    await flow.operation("confirm", () => Promise.resolve("confirmed"), {
      attempt: { groupId: "reservation", number: 2 },
    })
    flow.done()
    // Advanced auto-drain has no public flush; yield the event loop until its terminal transport call.
    await vi.waitFor(() => expect(events.at(-1)?.type).toBe("completed"))
    expect(
      events.find((event) => event.type === "operation_completed"),
    ).toMatchObject({ attempt: { number: 2 } })
  })
  it.each([false, true])(
    "requires attempts-v1 acknowledgment only for opted-in metadata (support=%s)",
    async (supported) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            Response.json(
              {
                accepted: true,
                ...(supported ? { capabilities: ["attempts-v1"] } : {}),
              },
              { status: 202 },
            ),
          ),
        ),
      )
      const diagnostic = vi.fn()
      const client = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: "synthetic-local-key",
        onInstrumentationError: diagnostic,
      })
      const flow = client.workflow("crm.sync", {
        retryOf: { workflow: "crm.sync", runId: "previous" },
      })
      flow.done()
      if (supported) {
        await client.shutdown()
        expect(diagnostic).not.toHaveBeenCalled()
      } else {
        const shutdown = await client.shutdown().then(
          () => undefined,
          (caught: unknown) => caught,
        )
        expect(shutdown).toBeInstanceOf(FlowmarkDeliveryError)
        if (shutdown instanceof FlowmarkDeliveryError) {
          expect(shutdown.failureCount).toBe(1)
        }
        const reported = diagnostic.mock.calls[0]?.[0]
        expect(reported).toBeInstanceOf(WorkflowTransportError)
        expect(diagnostic.mock.calls[0]?.[1]).toMatchObject({ type: "started" })
        if (reported instanceof WorkflowTransportError) {
          const reason = reported.cause.reasons[0]
          expect(Cause.isFailReason(reason)).toBe(true)
          if (Cause.isFailReason(reason)) {
            expect(reason.error).toBeInstanceOf(FlowmarkHttpError)
            if (reason.error instanceof FlowmarkHttpError) {
              expect(reason.error.status).toBe(202)
            }
          }
        }
      }
    },
  )
})
