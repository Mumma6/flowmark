import { Effect } from "effect"
import type { WorkflowEvent } from "@flowmark/core"
import type { WorkflowTransport } from "../ports/workflow-transport.js"

/** In-memory transport for tests/custom integrations. Nothing is sent to the Flowmark API. */
export class MemoryTransport implements WorkflowTransport {
  /** Successfully emitted events in delivery order. Not persisted across process restarts. */
  readonly events: WorkflowEvent[] = []

  /** Returns a lazy Effect that appends an event when executed. */
  emit(event: WorkflowEvent): Effect.Effect<void> {
    return Effect.sync(() => {
      this.events.push(event)
    })
  }
}
