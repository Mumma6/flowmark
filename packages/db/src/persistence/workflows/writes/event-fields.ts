import { Match } from "effect"
import type { WorkflowEvent } from "@flowmark/core"
import type { StoredWorkflowError } from "../../../schema/index.js"

const shortReason = (reason: string) =>
  reason.length > 0 && reason.length <= 128

export const eventFailure = (
  event: WorkflowEvent,
): StoredWorkflowError | null =>
  Match.value(event).pipe(
    Match.when({ type: "failed" }, ({ failure, reason }) => {
      if (failure) {
        return failure
      }
      if (reason === undefined) {
        return null
      }
      return shortReason(reason)
        ? { code: reason }
        : { code: "failed", message: reason }
    }),
    Match.when({ type: "operation_failed" }, ({ failure }) => failure),
    Match.orElse(() => null),
  )

export const eventProperties = (event: WorkflowEvent) =>
  Match.value(event).pipe(
    Match.when({ type: "started" }, ({ properties }) => properties),
    Match.when({ type: "step" }, ({ properties }) => properties),
    Match.when({ type: "properties" }, ({ properties }) => properties),
    Match.when({ type: "operation_started" }, ({ properties }) => properties),
    Match.orElse(() => undefined),
  )

export const eventResult = (event: WorkflowEvent) =>
  Match.value(event).pipe(
    Match.when({ type: "completed" }, ({ result }) => result),
    Match.when({ type: "failed" }, ({ result }) => result),
    Match.orElse(() => undefined),
  )

export const eventError = (
  event: WorkflowEvent,
  failure: StoredWorkflowError | null,
) => (event.type === "error" ? event.error : failure)

export const isTerminalError = (event: WorkflowEvent) =>
  event.type === "error" || event.type === "failed"
