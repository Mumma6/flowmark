import { Context, type Effect } from "effect"
import type { InvalidInput, PersistenceError } from "../../../errors.js"

export interface AgentAccessConnection {
  readonly authorizationCodeId: string
  readonly clientId: string
  readonly clientName: string | null
  readonly createdAt: string
  readonly projectIds: ReadonlyArray<string>
  readonly lastAuthenticatedAt: string | null
}

export interface AgentAccessService {
  readonly listConnections: (
    userId: string,
  ) => Effect.Effect<ReadonlyArray<AgentAccessConnection>, PersistenceError>
  readonly getConnection: (input: {
    readonly userId: string
    readonly authorizationCodeId: string
    readonly clientId: string
  }) => Effect.Effect<AgentAccessConnection | undefined, PersistenceError>
  readonly submitConsent: (input: {
    readonly userId: string
    readonly oauthConsentId: string
    readonly clientId: string
    readonly redirectUri: string
    readonly requestedScopes: ReadonlyArray<string>
    readonly resourceUrl: string
    readonly projectIds: ReadonlyArray<string>
  }) => Effect.Effect<string, InvalidInput | PersistenceError>
  readonly recordLastAuthenticated: (input: {
    readonly userId: string
    readonly clientId: string
    readonly authorizationCodeId: string
    readonly at: Date
  }) => Effect.Effect<void, PersistenceError>
  readonly revokeConnection: (input: {
    readonly userId: string
    readonly authorizationCodeId: string
    readonly clientId: string
  }) => Effect.Effect<void, InvalidInput | PersistenceError>
}

export class AgentAccess extends Context.Service<
  AgentAccess,
  AgentAccessService
>()("@flowmark/api/AgentAccess") {}
