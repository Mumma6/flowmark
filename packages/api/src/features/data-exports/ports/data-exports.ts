import { Context, type Effect } from "effect"
import type { LifecycleError } from "../../data-lifecycle/ports/data-lifecycle.js"

export interface ExportRequest {
  readonly id: string
  readonly projectId: string | null
  readonly state: "ready" | "complete" | "cancelled"
  readonly cutoff: string
  readonly expiresAt: string
  readonly cursor: string
  readonly part: number
}
export interface ExportPart {
  readonly body: string
  readonly complete: boolean
  readonly nextCursor: string | null
  readonly part: number
  readonly filename: string
  readonly bytes: number
}
export class DataExports extends Context.Service<
  DataExports,
  {
    readonly latest: (
      userId: string,
      sessionId: string,
      projectId: string | null,
    ) => Effect.Effect<ExportRequest | null, LifecycleError>
    readonly check: (
      userId: string,
      sessionId: string,
      id: string,
    ) => Effect.Effect<void, LifecycleError>
    readonly create: (
      userId: string,
      sessionId: string,
      projectId: string | null,
    ) => Effect.Effect<ExportRequest, LifecycleError>
    readonly cancel: (
      userId: string,
      sessionId: string,
      id: string,
    ) => Effect.Effect<{ readonly cancelled: true }, LifecycleError>
    readonly part: (
      userId: string,
      sessionId: string,
      id: string,
      cursor: string,
    ) => Effect.Effect<ExportPart, LifecycleError>
  }
>()("@flowmark/api/DataExports") {}
