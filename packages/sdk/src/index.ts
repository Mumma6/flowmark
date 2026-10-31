export { createFlowmark, workflow } from "./client/create-client.js"
export { defineConfig } from "./config/define-config.js"
export {
  FlowmarkErrorMappingError,
  FlowmarkConfigError,
  FlowmarkDeliveryError,
  FlowmarkHttpError,
  FlowmarkQueueError,
  WorkflowTransportError,
} from "./errors/index.js"
export { WorkflowTransport } from "./delivery/ports/workflow-transport.js"
export { MemoryTransport } from "./delivery/adapters/memory-transport.js"
export type {
  OperationErrorMapper,
  DeliveryOptions,
  DeliveryHealth,
  WorkflowDefinition,
  TypedFlow,
  TypedWorkflowOptions,
  Flow,
  FlowmarkClient,
  FlowmarkConfig,
  InstrumentationErrorHandler,
  WorkflowOptions,
  WorkflowRunOptions,
  WorkflowDoneOptions,
  WorkflowFailOptions,
  WorkflowStepOptions,
  WorkflowOperation,
  WorkflowOperationOptions,
} from "./types/index.js"
export type {
  JsonValue,
  WorkflowRunReference,
  WorkflowRunId,
  WorkflowError,
  WorkflowCorrelationId,
  WorkflowEvent,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowProgress,
  WorkflowOperationFailure,
  WorkflowResult,
  WorkflowOutcome,
} from "@flowmarkdev/core"

export type { WorkflowAttempt, WorkflowRetryReference } from "@flowmarkdev/core"
