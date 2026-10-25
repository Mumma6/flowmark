import type { WorkflowOperationOptions } from "../types/index.js"

export const splitOperationArgs = <T>(
  callbackOrOptions?: (() => PromiseLike<T>) | WorkflowOperationOptions,
  options?: WorkflowOperationOptions,
): {
  readonly callback?: () => PromiseLike<T>
  readonly options?: WorkflowOperationOptions
} =>
  typeof callbackOrOptions === "function"
    ? { callback: callbackOrOptions, options }
    : { options: callbackOrOptions }
