import { Context, Effect, Layer, Redacted } from "effect"
import {
  DEMO_READ_KEY,
  DEMO_WRITE_KEY,
  DIAGNOSTICS_WRITE_KEY,
} from "@flowmark/db/demo"
import { ApiSettings } from "../../../config.js"
import { PersistenceError, Unauthorized } from "../../../errors.js"
import { ProjectCredentials } from "../ports/project-credentials.js"

export interface AuthorizeProjectService {
  readonly authorize: (
    header: string | null,
    permission: "read" | "write",
  ) => Effect.Effect<string, Unauthorized | PersistenceError>
}

export class AuthorizeProject extends Context.Tag(
  "@flowmark/api/AuthorizeProject",
)<AuthorizeProject, AuthorizeProjectService>() {
  static readonly layer = Layer.effect(
    AuthorizeProject,
    Effect.gen(function* () {
      const credentials = yield* ProjectCredentials
      const settings = yield* ApiSettings

      const authorize = Effect.fn("AuthorizeProject.authorize")(function* (
        header: string | null,
        permission: "read" | "write",
      ) {
        if (!header?.startsWith("Bearer ")) {
          return yield* Effect.fail(new Unauthorized({ permission }))
        }
        const key = header.slice(7)
        if (
          !settings.demoMode &&
          (key === DEMO_READ_KEY ||
            key === DEMO_WRITE_KEY ||
            key === DIAGNOSTICS_WRITE_KEY)
        ) {
          return yield* Effect.fail(new Unauthorized({ permission }))
        }
        const projectId = yield* credentials.authenticate(
          Redacted.make(key),
          permission,
        )
        if (!projectId) {
          return yield* Effect.fail(new Unauthorized({ permission }))
        }
        return projectId
      })

      return AuthorizeProject.of({ authorize })
    }),
  )
}
