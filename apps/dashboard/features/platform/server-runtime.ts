import { Effect, Layer } from "effect"
import { cache } from "react"
import "server-only"
import { DashboardApi } from "./api-server-client"
import { readDashboardAccess } from "../auth/auth-access"
import { readDashboardSession } from "../auth/auth-session"
import { DashboardServerConfig } from "./config-server"
import { readRemoteAgentAccess } from "./read-remote-agent-access"

// Layers are descriptions. Configuration and upstream clients are acquired for
// each execution; no cookies or request identity live in shared mutable state.
const DashboardServerLive = DashboardApi.layer.pipe(
  Layer.provide(DashboardServerConfig.layer),
)

export const provideDashboardServer = <A, E>(
  effect: Effect.Effect<A, E, DashboardApi>,
) => effect.pipe(Effect.provide(DashboardServerLive))

export const runDashboardServer = <A, E>(
  effect: Effect.Effect<A, E, DashboardApi>,
) => Effect.runPromise(provideDashboardServer(effect))

export const runDashboardServerExit = <A, E>(
  effect: Effect.Effect<A, E, DashboardApi>,
) => Effect.runPromiseExit(provideDashboardServer(effect))

// React's cache is scoped to a server render, not shared between users.
export const getDashboardSession = cache(() =>
  runDashboardServer(readDashboardSession()),
)
export const getDashboardAccess = cache(() =>
  runDashboardServer(readDashboardAccess()),
)
export const getRemoteAgentAccess = cache((apiOrigin: string) =>
  runDashboardServer(readRemoteAgentAccess(apiOrigin)),
)
