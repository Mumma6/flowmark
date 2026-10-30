import type { RunEventRecorder } from "./workflow-events.js"
import type { Effect } from "effect"
import type {
  WorkflowError,
  WorkflowOperationFailure,
  WorkflowProperties,
  WorkflowResult,
  WorkflowProgress,
  WorkflowStepName,
} from "@flowmarkdev/core"
import type {
  WorkflowDoneOptions,
  WorkflowFailOptions,
  WorkflowOperationOptions,
  WorkflowStepOptions,
} from "../types/index.js"

export interface WorkflowOperationHandle {
  readonly operationId: string
  readonly done: Effect.Effect<void>
  readonly fail: (failure: WorkflowOperationFailure) => Effect.Effect<void>
}

export interface WorkflowHandle {
  readonly runId: string
  readonly step: (
    name: WorkflowStepName,
    options?: WorkflowStepOptions,
  ) => Effect.Effect<void>
  readonly done: (options?: WorkflowDoneOptions) => Effect.Effect<void>
  readonly fail: (options: WorkflowFailOptions) => Effect.Effect<void>
  readonly error: (error: WorkflowError) => Effect.Effect<void>
  readonly setProperties: (
    properties: WorkflowProperties,
  ) => Effect.Effect<void>
  readonly operation: (
    name: WorkflowStepName,
    options?: WorkflowOperationOptions,
  ) => Effect.Effect<WorkflowOperationHandle>
  readonly report: (snapshot: WorkflowResult) => Effect.Effect<void>
  readonly progress: (progress: WorkflowProgress) => Effect.Effect<void>
}

/** Run-local state shared by markers and operation handles, never by other runs. */
export interface RunLifecycle extends RunEventRecorder {
  readonly runId: string

  readonly isOpen: Effect.Effect<boolean>
  readonly isFinished: Effect.Effect<boolean>

  readonly done: (options?: WorkflowDoneOptions) => Effect.Effect<void>
  readonly fail: (options: WorkflowFailOptions) => Effect.Effect<void>

  readonly openOperation: (operationId: string) => Effect.Effect<boolean>
  readonly closeOperation: (operationId: string) => Effect.Effect<void>

  /** Called after recording an operation terminal, preserving delivery order. */
  readonly completeIfReady: Effect.Effect<void>
}
