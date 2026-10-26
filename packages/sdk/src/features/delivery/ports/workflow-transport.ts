import { Context, type Effect } from "effect"
import type { WorkflowEvent } from "@flowmarkdev/core"

/** Port for delivering validated workflow events to an external destination. */
export interface WorkflowTransport {
  /** Returns a lazy delivery Effect. Expected failures use the Effect error channel. */
  readonly emit: (event: WorkflowEvent) => Effect.Effect<void, Error>
}

/** Effect dependency tag for replacing delivery implementations. */
export const WorkflowTransport = Context.GenericTag<WorkflowTransport>(
  "@flowmarkdev/node/WorkflowTransport",
)
