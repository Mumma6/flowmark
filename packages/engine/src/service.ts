import { Context, Layer } from "effect"
import { summarizeOperations } from "./operations.js"
import { percentile } from "./statistics.js"
import { compareSummaries } from "./comparisons.js"
import { hasCycle } from "./graphs.js"
export interface EngineService {
  readonly summarizeOperations: typeof summarizeOperations
  readonly percentile: typeof percentile
  readonly compareSummaries: typeof compareSummaries
  readonly hasCycle: typeof hasCycle
}
export class Engine extends Context.Service<Engine, EngineService>()(
  "@flowmark/engine/Engine",
) {
  static readonly layer = Layer.succeed(
    Engine,
    Engine.of({ summarizeOperations, percentile, compareSummaries, hasCycle }),
  )
}
