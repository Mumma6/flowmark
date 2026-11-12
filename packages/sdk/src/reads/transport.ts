import { Cause, Effect, Exit, Ref, Result, type Schema } from "effect"
import { FlowmarkReadError } from "./error.js"
import { readEndpoint } from "./read-endpoint.js"
import { readRequest } from "./read-request.js"

export const createReadTransport = (options: {
  apiBaseUrl: string
  readKey: string
}) => {
  const endpoint = Result.match(readEndpoint(options.apiBaseUrl), {
    onSuccess: (url) => url,
    onFailure: (error) => {
      throw error
    },
  })
  const key = options.readKey
  // Capture fetch per client rather than relying on a cached Effect reference.
  const fetchRead = globalThis.fetch
  return {
    async request<I, O>(
      kind: "run" | "period",
      input: I,
      inputSchema: Schema.Codec<I>,
      outputSchema: Schema.Codec<O>,
      matches: (output: O, input: I) => boolean,
      requestOptions?: { signal?: AbortSignal },
    ): Promise<O> {
      const status = Ref.makeUnsafe<number | null>(null)
      const operation = readRequest(
        endpoint,
        key,
        fetchRead,
        status,
        kind,
        input,
        inputSchema,
        outputSchema,
        matches,
      )
      const result = await Effect.runPromiseExit(operation, {
        signal: requestOptions?.signal,
      })
      return Exit.match(result, {
        onSuccess: (value) => value,
        onFailure: (cause) => {
          if (requestOptions?.signal?.aborted) {
            throw new FlowmarkReadError("ABORTED", Ref.getUnsafe(status))
          }
          const reason = cause.reasons[0]
          if (
            cause.reasons.length === 1 &&
            reason &&
            Cause.isFailReason(reason)
          ) {
            throw reason.error
          }
          throw new FlowmarkReadError("NETWORK_ERROR", Ref.getUnsafe(status))
        },
      })
    },
  }
}
