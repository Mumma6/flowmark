import { AGENT_ACCESS_EXECUTION_BOUNDS } from "@flowmark/auth/agent-access"
import { Data, Effect, Stream } from "effect"

export class McpRequestBodyError extends Data.TaggedError(
  "McpRequestBodyError",
)<{
  readonly status: 400 | 408 | 413
}> {}

export const readMcpRequest = Effect.fn("Mcp.readRequest")(function* (
  request: Request,
) {
  const maximum = AGENT_ACCESS_EXECUTION_BOUNDS.maxRequestBytes
  if (Number(request.headers.get("content-length")) > maximum) {
    return yield* new McpRequestBodyError({ status: 413 })
  }
  if (!request.body) {
    return request
  }
  const bytes = new Uint8Array(maximum)
  const size = yield* Stream.fromReadableStream({
    evaluate: () => request.body!,
    onError: () => new McpRequestBodyError({ status: 400 }),
  }).pipe(
    Stream.runFoldEffect(
      () => 0,
      (offset, chunk) => {
        if (offset + chunk.byteLength > maximum) {
          return Effect.fail(new McpRequestBodyError({ status: 413 }))
        }
        return Effect.sync(() => {
          bytes.set(chunk, offset)
          return offset + chunk.byteLength
        })
      },
    ),
  )
  return new Request(request, { body: bytes.slice(0, size) })
})
