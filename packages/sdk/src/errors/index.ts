import { Data, type Cause } from "effect"
import type {
  WorkflowEvent,
  WorkflowEventValidationError,
} from "@flowmarkdev/core"

/** Invalid credentials/origin, unsupported execution context, or use of a closed client. */
export class FlowmarkConfigError extends Data.TaggedError(
  "FlowmarkConfigError",
)<{
  readonly cause: unknown
}> {
  get message() {
    return typeof this.cause === "string"
      ? this.cause
      : "Invalid Flowmark configuration. Check the API URL and server credentials; see the original cause for validation details."
  }
}

/** HTTP delivery failure; status is undefined for encoding, network, or timeout failures. Preserves the original cause. */
export class FlowmarkHttpError extends Data.TaggedError("FlowmarkHttpError")<{
  readonly retryable?: boolean
  readonly status: number | undefined
  readonly cause: unknown
}> {}

/** Associates a failed event with its Effect Cause, including original transport failures/defects. */
export class WorkflowTransportError extends Data.TaggedError(
  "WorkflowTransportError",
)<{
  readonly event: WorkflowEvent
  readonly cause: Cause.Cause<unknown>
}> {}

/** An event could not be queued because its bounded admission limit was reached or delivery was closed. */
export class FlowmarkQueueError extends Data.TaggedError("FlowmarkQueueError")<{
  readonly event: WorkflowEvent
  readonly reason: "capacity" | "closed"
}> {}

/** Bounded mapper diagnostic: deliberately excludes the original cause/payload. */
export class FlowmarkErrorMappingError extends Data.TaggedError(
  "FlowmarkErrorMappingError",
)<{ readonly reason: "threw" | "invalid" }> {}

export class FlowmarkExpectationError extends Data.TaggedError(
  "FlowmarkExpectationError",
)<{ readonly reason: "invalid-input" | "run-closed" | "source-forbidden" }> {}

/** Failures reported to onInstrumentationError or collected by flush()/shutdown(). */
export type DeliveryFailure =
  | FlowmarkExpectationError
  | WorkflowTransportError
  | WorkflowEventValidationError
  | FlowmarkQueueError
  | FlowmarkErrorMappingError

/** Rejection from flush()/shutdown(). At most 20 original failures are retained; counts include every failure since the previous drain. */
export class FlowmarkDeliveryError extends Data.TaggedError(
  "FlowmarkDeliveryError",
)<{
  readonly failures: ReadonlyArray<DeliveryFailure>
  readonly failureCount: number
  readonly omittedFailureCount: number
}> {}
