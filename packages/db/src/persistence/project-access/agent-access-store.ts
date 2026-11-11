import { getAgentAccessGrantFamily } from "./queries/get-agent-access-grant-family.js"
import { consumeMcpBudget } from "./writes/consume-mcp-budget.js"
import { Context, Effect, Layer } from "effect"
import type { DatabaseError } from "../database.js"
import { DatabaseCancellation, Database, provideDatabase } from "../database.js"
import type { AgentAccessConnectionSummary } from "./queries/list-agent-access-connections.js"
import { getAgentAccessConnectionDetail } from "./queries/get-agent-access-connection-detail.js"
import {
  getAgentAccessMcpConnection,
  type AgentAccessMcpConnectionSnapshot,
} from "./queries/get-agent-access-mcp-connection.js"
import { listAgentAccessConnections } from "./queries/list-agent-access-connections.js"
import {
  AgentAccessConsentRejected,
  AgentAccessNotFound,
} from "./agent-access-errors.js"
import { recordAgentAccessLastAuth } from "./writes/record-agent-access-last-auth.js"
import { revokeAgentAccessConnection } from "./writes/revoke-agent-access-connection.js"
import { submitAgentAccessConsent } from "./writes/submit-agent-access-consent.js"
import { getAgentConsentClient } from "./queries/get-agent-consent-client.js"
import { bindAgentConsentCode } from "./writes/bind-agent-consent-code.js"

export interface AgentAccessStoreService {
  readonly grantFamily: (
    input: Parameters<typeof getAgentAccessGrantFamily>[0],
  ) => Effect.Effect<string | undefined, DatabaseError>
  readonly consumeMcpBudget: (
    scope: string,
    maximum: number,
  ) => Effect.Effect<
    { readonly allowed: boolean; readonly retryAfter: number | null },
    DatabaseError
  >
  readonly consentClient: (clientId: string) => Effect.Effect<
    | {
        readonly clientId: string
        readonly name: string | null
        readonly redirectUris: readonly string[]
      }
    | undefined,
    DatabaseError
  >
  readonly bindConsentCode: (
    input: Parameters<typeof bindAgentConsentCode>[0],
  ) => Effect.Effect<void, AgentAccessConsentRejected | DatabaseError>
  readonly listConnections: (
    userId: string,
  ) => Effect.Effect<ReadonlyArray<AgentAccessConnectionSummary>, DatabaseError>
  readonly getConnection: (input: {
    readonly userId: string
    readonly authorizationCodeId: string
    readonly clientId: string
  }) => Effect.Effect<AgentAccessConnectionSummary | undefined, DatabaseError>
  readonly submitConsent: (input: {
    readonly userId: string
    readonly oauthConsentId: string
    readonly clientId: string
    readonly redirectUri: string
    readonly requestedScopes: ReadonlyArray<string>
    readonly resourceUrl: string
    readonly projectIds: ReadonlyArray<string>
  }) => Effect.Effect<string, AgentAccessConsentRejected | DatabaseError>
  readonly recordLastAuthenticated: (input: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly at: Date
  }) => Effect.Effect<void, DatabaseError>
  readonly revokeConnection: (input: {
    readonly userId: string
    readonly authorizationCodeId: string
    readonly clientId: string
  }) => Effect.Effect<void, AgentAccessNotFound | DatabaseError>
  readonly getMcpConnection: (input: {
    readonly userId: string
    readonly authorizationCodeId: string
    readonly clientId: string
  }) => Effect.Effect<
    AgentAccessMcpConnectionSnapshot | undefined,
    DatabaseError
  >
}

export class AgentAccessStore extends Context.Service<AgentAccessStore>()(
  "@flowmark/db/AgentAccessStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(
        yield* Database,
        yield* DatabaseCancellation,
      )
      return {
        grantFamily: (input) => provide(getAgentAccessGrantFamily(input)),
        consumeMcpBudget: (scope, maximum) =>
          provide(consumeMcpBudget(scope, maximum)),
        consentClient: (clientId) => provide(getAgentConsentClient(clientId)),
        bindConsentCode: (input) => provide(bindAgentConsentCode(input)),
        listConnections: (userId) =>
          provide(listAgentAccessConnections(userId)),
        getConnection: (input) =>
          provide(getAgentAccessConnectionDetail(input)),
        submitConsent: (input) => provide(submitAgentAccessConsent(input)),
        recordLastAuthenticated: (input) =>
          provide(recordAgentAccessLastAuth(input)),
        revokeConnection: (input) =>
          provide(revokeAgentAccessConnection(input)),
        getMcpConnection: (input) =>
          provide(getAgentAccessMcpConnection(input)),
      } satisfies AgentAccessStoreService
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
