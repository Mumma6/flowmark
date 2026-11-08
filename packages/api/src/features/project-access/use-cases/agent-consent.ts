import { Array, Context, Effect, Layer } from "effect"
import { InvalidInput } from "../../../errors.js"
import { ProjectCredentials } from "../ports/project-credentials.js"
import {
  AgentConsentRepository,
  type AgentConsentBinding,
} from "../ports/agent-consent-repository.js"

export class AgentConsent extends Context.Service<AgentConsent>()(
  "@flowmark/api/AgentConsent",
  {
    make: Effect.gen(function* () {
      const repository = yield* AgentConsentRepository
      const credentials = yield* ProjectCredentials
      const prepare = Effect.fn("AgentConsent.prepare")(function* (
        userId: string,
        clientId: string,
        redirectUri: string,
      ) {
        const client = yield* repository.client(clientId)
        if (!client || !client.redirectUris.includes(redirectUri)) {
          return yield* new InvalidInput({
            cause:
              "The client or redirect is no longer available. Restart authorization.",
          })
        }
        const projects = yield* credentials.listProjects(userId)
        return {
          clientId: client.clientId,
          clientName: client.name,
          projects: Array.map(projects, ({ id, name }) => ({ id, name })),
        }
      })
      return {
        prepare,
        bindCode: Effect.fn("AgentConsent.bindCode")(function* (
          input: AgentConsentBinding,
        ) {
          const available = yield* prepare(
            input.userId,
            input.clientId,
            input.redirectUri,
          )
          if (
            !input.projectIds.length ||
            input.projectIds.length > 10 ||
            Array.dedupe(input.projectIds).length !== input.projectIds.length ||
            !Array.every(input.projectIds, (id) =>
              Array.some(available.projects, (project) => project.id === id),
            )
          ) {
            return yield* new InvalidInput({
              cause:
                "Select between one and ten projects available to this account.",
            })
          }
          yield* repository.bindCode(input)
        }),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
