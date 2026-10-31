import { Effect, Schema } from "effect"
import { WorkflowFailureSchema, type WorkflowFailure } from "@flowmarkdev/core"
import { FlowmarkErrorMappingError } from "../errors/index.js"
import type { WorkflowOperationOptions } from "../types/index.js"
import { observeInvalidMapperPromise } from "./operation-callback.js"
import { failureFromUnknown } from "./failure-from-unknown.js"

export const genericOperationFailure: WorkflowFailure = {
  code: "operation_failed",
}

/** Deliberately retain neither the application cause nor the rejected mapped payload. */
export const mapOperationFailure = Effect.fn("Flowmark.mapOperationFailure")(
  function* (cause: unknown, options?: WorkflowOperationOptions) {
    const mapper = yield* Effect.try({
      try: () => options?.mapError,
      catch: () => new FlowmarkErrorMappingError({ reason: "threw" }),
    })
    if (mapper === undefined) {
      return yield* Effect.try({
        try: () => failureFromUnknown(cause),
        catch: () => new FlowmarkErrorMappingError({ reason: "threw" }),
      })
    }
    const mapped = yield* Effect.try({
      try: () => mapper(cause),
      catch: () => new FlowmarkErrorMappingError({ reason: "threw" }),
    })
    const asynchronous = yield* Effect.try({
      try: () => observeInvalidMapperPromise(mapped),
      catch: () => new FlowmarkErrorMappingError({ reason: "invalid" }),
    })
    if (asynchronous) {
      return yield* new FlowmarkErrorMappingError({ reason: "invalid" })
    }
    const snapshot = yield* Effect.try({
      try: () => {
        const { code, message, retryable } = mapped
        return {
          code,
          ...(message === undefined ? {} : { message }),
          ...(retryable === undefined ? {} : { retryable }),
        }
      },
      catch: () => new FlowmarkErrorMappingError({ reason: "invalid" }),
    })
    const safe = yield* Schema.decodeUnknownEffect(WorkflowFailureSchema)(
      snapshot,
    ).pipe(
      Effect.catchCause(() =>
        Effect.fail(new FlowmarkErrorMappingError({ reason: "invalid" })),
      ),
    )
    // Copy only the allowlisted fields; never merge raw exception details.
    return {
      code: safe.code,
      ...(safe.message === undefined ? {} : { message: safe.message }),
      ...(safe.retryable === undefined ? {} : { retryable: safe.retryable }),
    }
  },
)
