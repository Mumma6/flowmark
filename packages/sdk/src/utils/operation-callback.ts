import type { WorkflowOperation } from "../types/index.js"
import { failureFromUnknown } from "./failure-from-unknown.js"

export function withOperationCallback<T>(
  operation: WorkflowOperation,
  callback: () => PromiseLike<T>,
  failCallback: (cause: unknown) => void = (cause) =>
    operation.fail(failureFromUnknown(cause)),
): Promise<T> {
  let result: PromiseLike<T>
  try {
    result = callback()
  } catch (cause) {
    failCallback(cause)
    return Promise.reject(cause)
  }
  return Promise.resolve(result).then(
    (value) => {
      operation.done()
      return value
    },
    (cause: unknown) => {
      failCallback(cause)
      throw cause
    },
  )
}

/** Promise boundary: invalid async mappers must not create unhandled rejections.
 * Never await them or retain their result in telemetry/diagnostics.
 */
export function observeInvalidMapperPromise(value: unknown): boolean {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function") ||
    typeof (value as { then?: unknown }).then !== "function"
  ) {
    return false
  }
  void Promise.resolve(value).then(
    () => undefined,
    () => undefined,
  )
  return true
}
