import { AgentAccessStore } from "@flowmark/db/persistence"
import { Context, Effect, Layer, Schema } from "effect"
import { persist } from "../../../adapters/persistence-error.js"
import { Unauthorized, type PersistenceError } from "../../../errors.js"

export const McpAgentConnectionProjectSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
})

export const McpAgentConnectionSnapshotSchema = Schema.Struct({
  authorizationCodeId: Schema.String,
  clientId: Schema.String,
  clientName: Schema.NullOr(Schema.String),
  resourceUrl: Schema.String,
  readScope: Schema.Literal("flowmark:read"),
  projects: Schema.Array(McpAgentConnectionProjectSchema),
  toolsEnabled: Schema.Array(Schema.String),
  toolsPending: Schema.Array(Schema.String),
})

export type McpAgentConnectionSnapshot =
  typeof McpAgentConnectionSnapshotSchema.Type

const MCP_TOOLS_ENABLED = ["get_connection"] as const
const MCP_TOOLS_PENDING = [
  "list_workflows",
  "find_runs",
  "get_run",
  "compare_run",
  "get_workflow_insights",
] as const

export interface GetMcpAgentConnectionService {
  readonly resolve: (input: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly resourceUrl: string
    readonly authenticatedAt: Date
  }) => Effect.Effect<
    McpAgentConnectionSnapshot,
    Unauthorized | PersistenceError
  >
}

export class GetMcpAgentConnection extends Context.Service<
  GetMcpAgentConnection,
  GetMcpAgentConnectionService
>()("@flowmark/api/GetMcpAgentConnection") {}

export const GetMcpAgentConnectionLive = Layer.effect(
  GetMcpAgentConnection,
  Effect.gen(function* () {
    const store = yield* AgentAccessStore
    return GetMcpAgentConnection.of({
      resolve: Effect.fn("GetMcpAgentConnection.resolve")(function* (input) {
        const row = yield* persist(store.getMcpConnection(input))
        if (!row) {
          return yield* Effect.fail(new Unauthorized({ permission: "read" }))
        }
        yield* persist(
          store.recordLastAuthenticated({
            userId: input.userId,
            clientId: input.clientId,
            authorizationCodeId: input.authorizationCodeId,
            at: input.authenticatedAt,
          }),
        )
        return {
          authorizationCodeId: row.authorizationCodeId,
          clientId: row.clientId,
          clientName: row.clientName,
          resourceUrl: input.resourceUrl,
          readScope: "flowmark:read",
          projects: [...row.projects],
          toolsEnabled: [...MCP_TOOLS_ENABLED],
          toolsPending: [...MCP_TOOLS_PENDING],
        } satisfies McpAgentConnectionSnapshot
      }),
    })
  }),
)
