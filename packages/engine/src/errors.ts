import { Data } from "effect"
export class EngineError extends Data.TaggedError("EngineError")<{
  readonly operation:
    "summarizeOperations" | "percentile" | "compareSummaries" | "hasCycle"
  readonly stage:
    "initialization" | "input" | "invocation" | "output" | "calculation"
  readonly cause: unknown
}> {}
