import { Context, Effect, Layer } from "effect"
import { findRunsForMcp } from "./find-runs.js"
import { listWorkflowsForMcp } from "./list-workflows.js"

export class McpWorkflowTools extends Context.Service<McpWorkflowTools>()(
  "@flowmark/mcp/McpWorkflowTools",
  {
    make: Effect.succeed({
      listWorkflows: listWorkflowsForMcp,
      findRuns: findRunsForMcp,
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
