import type { WorkflowOperation } from "../types/index.js"

export function withOperationCallback<T>(
  operation: WorkflowOperation,
  callback: () => PromiseLike<T>,
): Promise<T> {
  let result: PromiseLike<T>
  try {
    result = callback()
  } catch (cause) {
    operation.fail({ code: "operation_callback_failed" })
    return Promise.reject(cause)
  }
  return Promise.resolve(result).then(
    (value) => {
      operation.done()
      return value
    },
    (cause: unknown) => {
      operation.fail({ code: "operation_callback_failed" })
      throw cause
    },
  )
}
