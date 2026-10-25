import type { WorkflowFailure } from "@flowmark/core"

const codeLimit = 128
const messageLimit = 2048

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const boundedCode = (value: unknown) =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= codeLimit &&
  value.trim().length > 0
    ? value
    : undefined

const boundedMessage = (value: unknown) =>
  typeof value === "string" && value.length > 0
    ? value.slice(0, messageLimit)
    : undefined

/** Maps a thrown callback value to a structured operation failure. */
export const failureFromUnknown = (cause: unknown): WorkflowFailure => {
  if (isRecord(cause)) {
    const code = boundedCode(cause.code)
    if (code !== undefined) {
      return {
        code,
        ...(boundedMessage(cause.message) === undefined
          ? {}
          : { message: boundedMessage(cause.message) }),
        ...(typeof cause.retryable === "boolean"
          ? { retryable: cause.retryable }
          : {}),
      }
    }
  }
  if (cause instanceof Error) {
    const message = boundedMessage(cause.message)
    return message === undefined
      ? { code: "operation_failed" }
      : { code: "operation_failed", message }
  }
  return { code: "operation_failed" }
}
