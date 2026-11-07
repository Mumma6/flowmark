import { Context, Effect, Layer } from "effect"
import { compareRunForMcp } from "./compare-run.js"
import { findRunsForMcp } from "./find-runs.js"
import { getRunForMcp } from "./get-run.js"
import { listWorkflowsForMcp } from "./list-workflows.js"

export class McpWorkflowTools extends Context.Service<McpWorkflowTools>()(
  "@flowmark/mcp/McpWorkflowTools",
  {
    make: Effect.succeed({
      listWorkflows: listWorkflowsForMcp,
      findRuns: findRunsForMcp,
      getRun: getRunForMcp,
      compareRun: compareRunForMcp,
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
