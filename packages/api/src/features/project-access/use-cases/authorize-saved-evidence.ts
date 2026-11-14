import { Effect, Match } from "effect"
import { Unauthorized } from "../../../errors.js"
import { AuthorizeProject } from "./authorize-project.js"
import { AgentAccess } from "../ports/agent-access.js"
import type { ProjectReader } from "../../workflows/models/project-reader.js"
export const savedEvidenceAuthorization = Effect.gen(function* () {
  const auth = yield* AuthorizeProject,
    agent = yield* AgentAccess
  return Effect.fn("AuthorizeSavedEvidence")(function* (
    reader: ProjectReader,
    projectId: string,
  ) {
    return yield* Match.value(reader).pipe(
      Match.tag("Key", () =>
        Effect.fail(new Unauthorized({ permission: "read" })),
      ),
      Match.tag("User", (reader) =>
        reader.projectId !== undefined &&
        reader.projectId.toLowerCase() !== projectId.toLowerCase()
          ? Effect.fail(new Unauthorized({ permission: "read" }))
          : auth.authorizeUser(reader.userId, projectId),
      ),
      Match.tag("DelegatedUser", (reader) =>
        Effect.gen(function* () {
          if (reader.projectId.toLowerCase() !== projectId.toLowerCase()) {
            return yield* new Unauthorized({ permission: "read" })
          }
          yield* auth.authorizeDelegatedReader(reader)
          yield* agent.recordLastAuthenticated({
            userId: reader.userId,
            clientId: reader.clientId,
            authorizationCodeId: reader.authorizationCodeId,
            at: new Date(),
          })
          return projectId
        }),
      ),
      Match.exhaustive,
    )
  })
})
