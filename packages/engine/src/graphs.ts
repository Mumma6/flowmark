import { Effect, Schema } from "effect"
import { invoke } from "./boundary.js"

export const DirectedGraphSchema = Schema.Struct({
  nodes: Schema.Array(Schema.String),
  edges: Schema.Array(
    Schema.Struct({ from: Schema.String, to: Schema.String }),
  ),
})
export type DirectedGraph = typeof DirectedGraphSchema.Type
export const hasCycle = Effect.fn("Engine.hasCycle")((graph: DirectedGraph) =>
  invoke("hasCycle", graph, DirectedGraphSchema, Schema.Boolean),
)
