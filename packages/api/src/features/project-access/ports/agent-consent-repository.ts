import { Context, type Effect } from "effect"
import type { InvalidInput, PersistenceError } from "../../../errors.js"

export interface AgentConsentBinding {
  readonly userId: string
  readonly sessionId: string
  readonly clientId: string
  readonly resourceUrl: string
  readonly redirectUri: string
  readonly authorizationCodeId: string
  readonly projectIds: readonly string[]
}
export class AgentConsentRepository extends Context.Service<
  AgentConsentRepository,
  {
    readonly client: (id: string) => Effect.Effect<
      | {
          readonly clientId: string
          readonly name: string | null
          readonly redirectUris: readonly string[]
        }
      | undefined,
      PersistenceError
    >
    readonly bindCode: (
      input: AgentConsentBinding,
    ) => Effect.Effect<void, InvalidInput | PersistenceError>
  }
>()("@flowmark/api/AgentConsentRepository") {}
