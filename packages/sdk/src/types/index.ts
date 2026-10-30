import type {
  WorkflowEvent,
  WorkflowOutcome,
  WorkflowName,
  WorkflowCorrelationId,
  WorkflowError,
  WorkflowFailure,
  WorkflowProperties,
  WorkflowProgress,
  WorkflowResult,
  WorkflowRunId,
  WorkflowStepName,
} from "@flowmarkdev/core"
import type { DeliveryFailure } from "../errors/index.js"
import type { WorkflowTransport } from "../features/delivery/ports/workflow-transport.js"

/**
 * Receives delivery/validation failures without throwing them into application code.
 * Throwing from this callback is logged and contained by the SDK.
 */
export type InstrumentationErrorHandler = (
  error: DeliveryFailure,
  event: WorkflowEvent,
) => void

/** Server-only client options. Omit values to read FLOWMARK_* environment variables. */
export interface FlowmarkConfig {
  /**
   * Secret project write key. Defaults to FLOWMARK_API_KEY.
   * Server only — never NEXT_PUBLIC_* or a browser bundle.
   */
  readonly apiKey?: string
  /**
   * Flowmark API origin, not an ingestion path.
   * Defaults to FLOWMARK_API_URL or http://localhost:3003 outside production.
   * Production requires an explicit origin. HTTPS is required except on localhost.
   */
  readonly apiUrl?: string
  /** Optional deployment environment added to each started event. */
  readonly environment?: string
  /** Optional release/version added to each started event. */
  readonly release?: string
  /** Receives typed failures. If omitted, the SDK logs delivery warnings. */
  readonly onInstrumentationError?: InstrumentationErrorHandler
}

/** Optional metadata for one execution of a workflow. */
export interface WorkflowRunOptions {
  /**
   * ID for this execution. A UUID is generated if omitted.
   * Same name + same id on a later request continues this run (second started is ignored).
   * Do not call done() until that whole process ends.
   * Do not reuse a durable entity id that outlives one execution; put those in properties.
   */
  readonly id?: WorkflowRunId
  /** Bounded JSON-safe context sent with the start event. Never include secrets or unnecessary personal data. */
  readonly properties?: WorkflowProperties
  /** Optional deployment environment; overrides the client default. */
  readonly environment?: string
  /** Optional release/version; overrides the client default. */
  readonly release?: string
  /**
   * Explicit identifier grouping related runs. Keep it bounded and non-sensitive;
   * it is not an automatic trace ID or proof of a causal relationship.
   */
  readonly correlationId?: WorkflowCorrelationId
  /**
   * Parent run's external SDK run ID, explicitly propagated by application code.
   * It is not the dashboard's internal UUID. Browser-supplied values are
   * untrusted and must not be treated as identity.
   */
  readonly parentRunId?: WorkflowRunId
}

/** Optional context attached to a semantic step without executing business logic. */
export interface WorkflowStepOptions {
  readonly properties?: WorkflowProperties
}

/** Optional JSON-safe result recorded when the workflow completes. */
export interface WorkflowDoneOptions {
  /** Application-reported business outcome, independent of execution status. */
  readonly outcome?: WorkflowOutcome
  readonly result?: WorkflowResult
}

/**
 * Structured terminal failure. `code` is required; `result` is the same kind of
 * bounded business summary accepted by done().
 */
export interface WorkflowFailOptions extends WorkflowFailure {
  /** Optional business outcome; useful work may accompany technical failure. */
  readonly outcome?: WorkflowOutcome
  readonly result?: WorkflowResult
}

/** Optional context attached when an operation starts. */
export interface WorkflowOperationOptions {
  readonly properties?: WorkflowProperties
}

/** Explicit lifecycle handle for a single independently identified operation. */
export interface WorkflowOperation {
  /** Unique UUID identifying this operation event family. */
  readonly operationId: string
  /** Marks the operation successful and records its monotonic duration. */
  done(): void
  /** Marks the operation failed and records its monotonic duration. */
  fail(failure: WorkflowFailure): void
}

/** Advanced custom-transport options. Normal consumers should use createFlowmark(). */
export interface WorkflowOptions extends WorkflowRunOptions {
  /** Required, unique execution ID for the low-level workflow() API. */
  readonly id: WorkflowRunId
  /** Effect-based event destination; not required by configured clients. */
  readonly transport: WorkflowTransport
  /** Receives typed failures without interrupting the host application. */
  readonly onInstrumentationError?: InstrumentationErrorHandler
}

/**
 * Markers for one workflow run. Delivery happens asynchronously in the background.
 * Properties/results must be JSON-safe objects within the shared @flowmarkdev/core
 * limits: 5 nested levels, 128 keys, 128-character keys, 2,048-character
 * strings, and 16 KiB encoded per object.
 */
export interface Flow {
  /** This run's SDK identifier (options.id, or a generated UUID). */
  readonly runId: WorkflowRunId
  /**
   * Records a meaningful checkpoint. Does not execute the step's business logic.
   * Calls after done() or fail() are ignored.
   * @param name A stable semantic name, such as "payment-created".
   * @param options Optional step-local bounded JSON properties.
   */
  step(name: WorkflowStepName, options?: WorkflowStepOptions): void
  /**
   * Ends the run as successful. Call only when the whole process is finished —
   * not in the first handler of a multi-request flow.
   * If operations are open, completion waits until they close. First terminal wins.
   */
  done(options?: WorkflowDoneOptions): void
  /**
   * Ends the run as failed without throwing. Call only when the whole process
   * is finished. `code` is required. Can supersede a pending done().
   */
  fail(options: WorkflowFailOptions): void
  /**
   * Records an error without terminating the run.
   * `handled` describes application handling; only fail() makes the run failed.
   */
  error(error: WorkflowError): void
  /**
   * Appends a shallow context amendment; previous event history is never rewritten.
   * When keys repeat, the newest value applies to the run's current context.
   */
  setProperties(properties: WorkflowProperties): void
  /**
   * Starts an independently identified operation.
   * Operations may overlap; each returned handle must be closed by its caller.
   * An operation callback reports its own success/failure and preserves the
   * callback's result or original rejection; it never fails the workflow.
   */
  operation(
    name: WorkflowStepName,
    options?: WorkflowOperationOptions,
  ): WorkflowOperation
  operation<T>(
    name: WorkflowStepName,
    callback: () => PromiseLike<T>,
    options?: WorkflowOperationOptions,
  ): Promise<T>
  /** Records an absolute progress snapshot; invalid values are rejected by validation. */
  progress(progress: WorkflowProgress): void

  /** Absolute non-final result snapshot. Omitted fields become unknown; never inherited by done/fail. */
  report(snapshot: WorkflowResult): void
}

/** Ordinary TypeScript client; Effect execution is managed internally. */
export interface FlowmarkClient {
  /**
   * Starts a run, or continues one when `options.id` matches an existing run
   * of the same workflow name. Omit `id` for a new execution.
   * Persist `flow.runId` if a later request should append to this run.
   * @param name Stable process name, such as "checkout.order" or "expedition.run".
   * @throws FlowmarkConfigError If configuration/context is invalid or the client was shut down.
   * @example
   * const flow = flowmark.workflow("checkout.order", { properties: { orderId } })
   * flow.step("payment-captured")
   * flow.done({ result: { shipmentId } })
   */
  workflow(name: WorkflowName, options?: WorkflowRunOptions): Flow
  /**
   * Waits for pending deliveries without closing the client.
   * Rejects with FlowmarkDeliveryError if delivery failed or the queue overflowed.
   * Browser clients can use this before full-page navigation; it does not guarantee offline delivery.
   */
  flush(): Promise<void>
  /**
   * Stops accepting workflows, drains pending deliveries, and releases SDK resources.
   * Call before a Node.js process/job exits. The Next.js adapter handles this automatically.
   * Rejects with FlowmarkDeliveryError when draining reports delivery failures.
   */
  shutdown(): Promise<void>
}
