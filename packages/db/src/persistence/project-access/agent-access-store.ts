import { Context, Effect, Layer } from "effect"
import type { DatabaseError } from "../database.js"
import { Database, provideDatabase } from "../database.js"
import type { AgentAccessConnectionSummary } from "./queries/list-agent-access-connections.js"
import { getAgentAccessConnectionDetail } from "./queries/get-agent-access-connection-detail.js"
import { listAgentAccessConnections } from "./queries/list-agent-access-connections.js"
import { AgentAccessConsentRejected } from "./agent-access-errors.js"
import { recordAgentAccessLastAuth } from "./writes/record-agent-access-last-auth.js"
import { submitAgentAccessConsent } from "./writes/submit-agent-access-consent.js"

export interface AgentAccessStoreService {
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
}

export class AgentAccessStore extends Context.Service<AgentAccessStore>()(
  "@flowmark/db/AgentAccessStore",
  {
    make: Effect.gen(function* () {
      const provide = provideDatabase(yield* Database)
      return {
        listConnections: (userId) =>
          provide(listAgentAccessConnections(userId)),
        getConnection: (input) =>
          provide(getAgentAccessConnectionDetail(input)),
        submitConsent: (input) => provide(submitAgentAccessConsent(input)),
        recordLastAuthenticated: (input) =>
          provide(recordAgentAccessLastAuth(input)),
      } satisfies AgentAccessStoreService
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
