import { Data, Result, Schema } from "effect"
import type { WorkflowOperationOptions } from "@flowmarkdev/node"

export const TraceReferenceSchema = Schema.Struct({
  traceId: Schema.String.check(Schema.isPattern(/^(?!0{32}$)[0-9a-f]{32}$/)),
  spanId: Schema.String.check(Schema.isPattern(/^(?!0{16}$)[0-9a-f]{16}$/)),
  serviceName: Schema.String.check(
    Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9._/-]{0,79}$/),
  ),
})

export type TraceReference = typeof TraceReferenceSchema.Type
export type TraceProperties = { readonly traceContext: TraceReference }

/** App-owned reader of an already-configured tracer; never installs tracing. */
export type ReadSpanContext = () =>
  { readonly traceId: unknown; readonly spanId: unknown } | null | undefined

export class TraceReferenceUnavailable extends Data.TaggedError(
  "TraceReferenceUnavailable",
)<{
  readonly reason: "missing" | "invalid" | "reader-failed" | "oversized"
}> {}

/** Example convention, not a new SDK field or export. No raw context/error retained. */
export function captureTraceProperties(
  readSpanContext: ReadSpanContext,
  serviceName: string,
): Result.Result<TraceProperties, TraceReferenceUnavailable> {
  return Result.gen(function* () {
    const selected = yield* Result.try({
      try: () => {
        const context = readSpanContext()
        // Select fresh primitives, never spread SpanContext or baggage.
        return context == null
          ? undefined
          : {
              traceId: context.traceId,
              spanId: context.spanId,
              serviceName,
            }
      },
      catch: () => new TraceReferenceUnavailable({ reason: "reader-failed" }),
    })
    if (selected === undefined) {
      return yield* Result.fail(
        new TraceReferenceUnavailable({ reason: "missing" }),
      )
    }
    const traceContext = yield* Schema.decodeUnknownResult(
      TraceReferenceSchema,
    )(selected).pipe(
      Result.mapError(
        () => new TraceReferenceUnavailable({ reason: "invalid" }),
      ),
    )
    const properties = { traceContext }
    if (new TextEncoder().encode(JSON.stringify(properties)).byteLength > 256) {
      return yield* Result.fail(
        new TraceReferenceUnavailable({ reason: "oversized" }),
      )
    }
    return properties
  })
}

/** Capture at the call site, immediately before flow.operation(), on every request. */
export function traceOperationOptions(
  readSpanContext: ReadSpanContext,
  serviceName: string,
): WorkflowOperationOptions {
  return captureTraceProperties(readSpanContext, serviceName).pipe(
    Result.match({
      // This recipe explicitly owns omission of optional instrumentation.
      onFailure: () => ({}),
      onSuccess: (properties) => ({ properties }),
    }),
  )
}
