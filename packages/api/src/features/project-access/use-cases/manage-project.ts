import { Context, Effect, Layer } from "effect"
import {
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"
import { AuthorizeProject } from "./authorize-project.js"
import {
  ProjectCredentials,
  type ApiKeySummary,
  type BrowserKeySummary,
  type CreatedSecret,
  type ProjectSummary,
} from "../ports/project-credentials.js"

const maxName = 80

const requireName = (value: string, label: string) => {
  const name = value.trim()
  if (name.length === 0 || name.length > maxName) {
    return Effect.fail(
      new InvalidInput({
        cause: `${label} must be 1–${maxName} characters.`,
      }),
    )
  }
  return Effect.succeed(name)
}

const requireOrigins = (origins: ReadonlyArray<string>) => {
  const allowed = origins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
  if (
    allowed.length === 0 ||
    allowed.some((origin) => !/^https?:\/\//i.test(origin))
  ) {
    return Effect.fail(
      new InvalidInput({
        cause: "Add at least one http(s) origin for the browser key.",
      }),
    )
  }
  return Effect.succeed(allowed)
}

export interface ProjectKeys {
  readonly apiKeys: ReadonlyArray<ApiKeySummary>
  readonly browserKeys: ReadonlyArray<BrowserKeySummary>
}

export interface CreatedProject {
  readonly project: ProjectSummary
  readonly writeKey: CreatedSecret
}

export interface ManageProjectService {
  readonly list: (
    userId: string,
  ) => Effect.Effect<ReadonlyArray<ProjectSummary>, PersistenceError>
  readonly create: (
    userId: string,
    name: string,
  ) => Effect.Effect<CreatedProject, InvalidInput | PersistenceError>
  readonly rename: (
    userId: string,
    projectId: string,
    name: string,
  ) => Effect.Effect<void, InvalidInput | Unauthorized | PersistenceError>
  readonly keys: (
    userId: string,
    projectId: string,
  ) => Effect.Effect<ProjectKeys, Unauthorized | PersistenceError>
  readonly createWriteKey: (
    userId: string,
    projectId: string,
    name: string,
  ) => Effect.Effect<
    CreatedSecret,
    InvalidInput | Unauthorized | PersistenceError
  >
  readonly revokeApiKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<void, InvalidInput | Unauthorized | PersistenceError>
  readonly createBrowserKey: (
    userId: string,
    projectId: string,
    input: { readonly name: string; readonly origins: ReadonlyArray<string> },
  ) => Effect.Effect<
    CreatedSecret,
    InvalidInput | Unauthorized | PersistenceError
  >
  readonly revokeBrowserKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<void, InvalidInput | Unauthorized | PersistenceError>
  readonly rotateWriteKey: (
    userId: string,
    projectId: string,
    keyId: string,
  ) => Effect.Effect<
    CreatedSecret,
    InvalidInput | Unauthorized | PersistenceError
  >
}

export class ManageProject extends Context.Tag("@flowmark/api/ManageProject")<
  ManageProject,
  ManageProjectService
>() {
  static readonly layer = Layer.effect(
    ManageProject,
    Effect.gen(function* () {
      const authorization = yield* AuthorizeProject
      const credentials = yield* ProjectCredentials

      const requireMember = (userId: string, projectId: string) =>
        authorization.authorizeUser(userId, projectId)

      const list = Effect.fn("ManageProject.list")((userId: string) =>
        credentials.listProjects(userId),
      )

      const create = Effect.fn("ManageProject.create")(function* (
        userId: string,
        rawName: string,
      ) {
        const name = yield* requireName(rawName, "Project name")
        const workspaceId = yield* credentials.workspaceForUser(userId)
        if (!workspaceId) {
          const created = yield* credentials.createOwnedProject(userId, {
            workspace: name,
            project: name,
          })
          return {
            project: {
              id: created.projectId,
              name,
              createdAt: new Date().toISOString(),
            },
            writeKey: {
              id: created.projectId,
              name: "Write key",
              prefix: created.writeKey.slice(0, 16),
              secret: created.writeKey,
            },
          } satisfies CreatedProject
        }
        const created = yield* credentials.createProject(
          userId,
          workspaceId,
          name,
        )
        return {
          project: {
            id: created.projectId,
            name,
            createdAt: new Date().toISOString(),
          },
          writeKey: created.writeKey,
        } satisfies CreatedProject
      })

      const rename = Effect.fn("ManageProject.rename")(function* (
        userId: string,
        projectId: string,
        rawName: string,
      ) {
        const name = yield* requireName(rawName, "Project name")
        yield* requireMember(userId, projectId)
        yield* credentials.renameProject(projectId, name)
      })

      const keys = Effect.fn("ManageProject.keys")(function* (
        userId: string,
        projectId: string,
      ) {
        yield* requireMember(userId, projectId)
        const [apiKeys, browserKeys] = yield* Effect.all([
          credentials.listApiKeys(projectId),
          credentials.listBrowserKeys(projectId),
        ])
        return { apiKeys, browserKeys }
      })

      const createWriteKey = Effect.fn("ManageProject.createWriteKey")(
        function* (userId: string, projectId: string, rawName: string) {
          const name = yield* requireName(rawName, "Key name")
          yield* requireMember(userId, projectId)
          return yield* credentials.createApiKey(projectId, {
            name,
            permission: "write",
          })
        },
      )

      const revokeApiKey = Effect.fn("ManageProject.revokeApiKey")(function* (
        userId: string,
        projectId: string,
        keyId: string,
      ) {
        yield* requireMember(userId, projectId)
        const deleted = yield* credentials.revokeApiKey(projectId, keyId)
        if (!deleted) {
          return yield* new InvalidInput({ cause: "Unknown API key." })
        }
      })

      const createBrowserKey = Effect.fn("ManageProject.createBrowserKey")(
        function* (
          userId: string,
          projectId: string,
          input: {
            readonly name: string
            readonly origins: ReadonlyArray<string>
          },
        ) {
          const name = yield* requireName(input.name, "Key name")
          const origins = yield* requireOrigins(input.origins)
          yield* requireMember(userId, projectId)
          return yield* credentials.createBrowserKey(projectId, {
            name,
            origins,
          })
        },
      )

      const revokeBrowserKey = Effect.fn("ManageProject.revokeBrowserKey")(
        function* (userId: string, projectId: string, keyId: string) {
          yield* requireMember(userId, projectId)
          const deleted = yield* credentials.revokeBrowserKey(projectId, keyId)
          if (!deleted) {
            return yield* new InvalidInput({ cause: "Unknown browser key." })
          }
        },
      )

      const rotateWriteKey = Effect.fn("ManageProject.rotateWriteKey")(
        function* (userId: string, projectId: string, keyId: string) {
          const created = yield* createWriteKey(userId, projectId, "Write key")
          const deleted = yield* credentials.revokeApiKey(projectId, keyId)
          if (!deleted) {
            return yield* new InvalidInput({
              cause: "Could not revoke the previous write key.",
            })
          }
          return created
        },
      )

      return ManageProject.of({
        list,
        create,
        rename,
        keys,
        createWriteKey,
        revokeApiKey,
        createBrowserKey,
        revokeBrowserKey,
        rotateWriteKey,
      })
    }),
  )
}
