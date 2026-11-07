import { createMcpHttpRoutes, type McpRouteRequirements } from "@flowmark/mcp"
import { Effect } from "effect"
import { McpServerLayer } from "./adapters/mcp/mcp-layers"

export const runMcpRoute = <A, E>(
  effect: Effect.Effect<A, E, McpRouteRequirements>,
) => Effect.runPromise(effect.pipe(Effect.provide(McpServerLayer)))

export const { handleMcpPost, handleMcpProtectedResourceMetadata } =
  createMcpHttpRoutes(runMcpRoute)
