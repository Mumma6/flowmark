import type { AppRouter } from "@flowmark/server/trpc"
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server"

export type Snapshot = inferRouterOutputs<AppRouter>["project"]["snapshot"]
export type Intelligence =
  inferRouterOutputs<AppRouter>["project"]["intelligence"]
export type Run = Snapshot["runs"][number]
export type WorkflowSummary = Snapshot["workflows"][number]

export type DayInsight = Snapshot["daily"][number]

export type RunEvent = inferRouterOutputs<AppRouter>["run"]["detail"][number]
export type RunRelationships = inferRouterOutputs<AppRouter>["run"]["related"]
export type RunComparison = inferRouterOutputs<AppRouter>["run"]["compare"]

export type RouterInputs = inferRouterInputs<AppRouter>
export type RouterOutputs = inferRouterOutputs<AppRouter>
