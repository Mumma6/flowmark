import { describe, expect, it } from "vitest"
import {
  getRunTimelineKind,
  runTimelineDetail,
} from "../app/run-event-timeline"
import type { RunEvent } from "../app/run-event-table"

function event(
  partial: Partial<RunEvent> & Pick<RunEvent, "id" | "type" | "timestamp">,
): RunEvent {
  return partial as RunEvent
}

describe("run event timeline", () => {
  it("maps telemetry types to visual kinds", () => {
    expect(
      getRunTimelineKind(event({ id: "1", type: "started", timestamp: "t" })),
    ).toBe("start")
    expect(
      getRunTimelineKind(event({ id: "2", type: "step", timestamp: "t" })),
    ).toBe("checkpoint")
    expect(
      getRunTimelineKind(
        event({
          id: "3",
          type: "error",
          timestamp: "t",
          error: { code: "X", handled: true },
        }),
      ),
    ).toBe("error")
    expect(
      getRunTimelineKind(
        event({
          id: "4",
          type: "error",
          timestamp: "t",
          error: { code: "X", handled: false },
        }),
      ),
    ).toBe("terminal-fail")
    expect(
      getRunTimelineKind(
        event({
          id: "5",
          type: "operation_completed",
          timestamp: "t",
          operationId: "a",
        }),
      ),
    ).toBe("operation")
  })

  it("summarizes progress and checkpoints for the timeline rail", () => {
    expect(
      runTimelineDetail(
        event({
          id: "1",
          type: "step",
          timestamp: "t",
          step: "payment-captured",
        }),
      ),
    ).toBe("payment-captured")
    expect(
      runTimelineDetail(
        event({
          id: "2",
          type: "progress",
          timestamp: "t",
          completed: 3,
          total: 5,
          unit: "orders",
        }),
      ),
    ).toBe("3 / 5 orders")
  })
})
