import type { WorkflowOperation } from "../types/index.js"
import { failureFromUnknown } from "./failure-from-unknown.js"

export function withOperationCallback<T>(
  operation: WorkflowOperation,
  callback: () => PromiseLike<T>,
): Promise<T> {
  let result: PromiseLike<T>
  try {
    result = callback()
  } catch (cause) {
    operation.fail(failureFromUnknown(cause))
    return Promise.reject(cause)
  }
  return Promise.resolve(result).then(
    (value) => {
      operation.done()
      return value
    },
    (cause: unknown) => {
      operation.fail(failureFromUnknown(cause))
      throw cause
    },
  )
}
