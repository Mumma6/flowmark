import { Effect, Result, Layer, Redacted } from "effect"
import { describe, expect, it, vi } from "vitest"
import { ApiSettings } from "../../src/config"
import { AuthorizeProject } from "../../src/features/project-access/use-cases/authorize-project"
import { ManageProject } from "../../src/features/project-access/use-cases/manage-project"
import { Onboarding } from "../../src/features/project-access/use-cases/onboarding"
import {
  ProjectCredentials,
  type ProjectCredentialsService,
} from "../../src/features/project-access/ports/project-credentials"
const expectLeft = <E>(result: Result.Result<unknown, E>, expected: unknown) =>
  Result.match(result, {
    onFailure: (error) => expect(error).toMatchObject(expected as object),
    onSuccess: () => expect.fail("expected a failure"),
  })

function projectCredentials(
  overrides: Partial<ProjectCredentialsService> = {},
) {
  return ProjectCredentials.of({
    authenticateBrowser: () => Effect.succeed(undefined),
    browserOriginAllowed: () => Effect.succeed(false),
    consumeBrowserQuota: () => Effect.succeed(false),
    authenticate: () => Effect.succeed("project-1"),
    projectForUser: () => Effect.succeed("project-1"),
    memberProject: () => Effect.succeed("project-1"),
    listProjects: () =>
      Effect.succeed([
        {
          id: "project-1",
          name: "Operations",
          createdAt: "2026-10-25T00:00:00.000Z",
        },
      ]),
    workspaceForUser: () => Effect.succeed("workspace-1"),
    onboardingState: () =>
      Effect.succeed({ step: "project" as const, completedAt: null }),
    updateOnboardingState: () => Effect.void,
    createOwnedProject: () =>
      Effect.succeed({
        projectId: "project-1",
        writeKey: {
          id: "key-owned",
          name: "Write key",
          prefix: "fm_write_abcdef",
          secret: "fm_write_secret",
        },
      }),
    createProject: () =>
      Effect.succeed({
        projectId: "project-2",
        writeKey: {
          id: "key-new",
          name: "Write key",
          prefix: "fm_write_abcdef",
          secret: "fm_write_secret",
        },
      }),
    renameProject: () => Effect.void,
    listApiKeys: () => Effect.succeed([]),
    listBrowserKeys: () => Effect.succeed([]),
    createApiKey: () =>
      Effect.succeed({
        id: "key-1",
        name: "Write key",
        prefix: "fm_write_abcdef",
        secret: "fm_write_secret",
      }),
    revokeApiKey: () => Effect.succeed(true),
    rotateWriteKey: () =>
      Effect.succeed({
        id: "key-rotated",
        name: "Worker",
        prefix: "fm_write_abcdef",
        secret: "fm_write_secret",
      }),
    createBrowserKey: () =>
      Effect.succeed({
        id: "key-2",
        name: "Browser key",
        prefix: "fm_browser_abcdef",
        secret: "fm_browser_secret",
      }),
    revokeBrowserKey: () => Effect.succeed(true),
    ...overrides,
  })
}

function provide(credentials = projectCredentials()) {
  return ManageProject.layer.pipe(
    Layer.provide(AuthorizeProject.layer),
    Layer.provide(Layer.succeed(ProjectCredentials, credentials)),
    Layer.provide(
      Layer.succeed(ApiSettings, {
        databaseUrl: Redacted.make("postgresql://unused"),
        demoMode: true,
      }),
    ),
  )
}

function provideOnboarding(credentials = projectCredentials()) {
  return Onboarding.layer.pipe(
    Layer.provide(Layer.succeed(ProjectCredentials, credentials)),
  )
}

describe("ManageProject", () => {
  it("creates a project in the existing workspace", async () => {
    const createProject = vi.fn(projectCredentials().createProject)
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        manage.create("user-1", "  Staging  "),
      ).pipe(Effect.provide(provide(projectCredentials({ createProject })))),
    )
    expect(result.project.name).toBe("Staging")
    expect(result.writeKey.secret).toBe("fm_write_secret")
    expect(createProject).toHaveBeenCalledWith(
      "user-1",
      "workspace-1",
      "Staging",
    )
  })

  it("rejects a blank project name", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        Effect.result(manage.create("user-1", "   ")),
      ).pipe(Effect.provide(provide())),
    )
    expectLeft(result, { _tag: "InvalidInput" })
  })

  it("creates a write key after membership is confirmed", async () => {
    const memberProject = vi.fn(() => Effect.succeed("project-1"))
    const createApiKey = vi.fn(projectCredentials().createApiKey)
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        manage.createWriteKey("user-1", "project-1", "Ingestion"),
      ).pipe(
        Effect.provide(
          provide(projectCredentials({ memberProject, createApiKey })),
        ),
      ),
    )
    expect(result.secret).toBe("fm_write_secret")
    expect(memberProject).toHaveBeenCalledWith("user-1", "project-1")
    expect(createApiKey).toHaveBeenCalledWith("project-1", {
      name: "Ingestion",
      permission: "write",
    })
  })

  it("returns the stored write key for the first project", async () => {
    const createOwnedProject = vi.fn(projectCredentials().createOwnedProject)
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        manage.create("user-1", "Operations"),
      ).pipe(
        Effect.provide(
          provide(
            projectCredentials({
              workspaceForUser: () => Effect.succeed(undefined),
              createOwnedProject,
            }),
          ),
        ),
      ),
    )
    expect(result.writeKey).toEqual({
      id: "key-owned",
      name: "Write key",
      prefix: "fm_write_abcdef",
      secret: "fm_write_secret",
    })
    expect(result.writeKey.id).not.toBe(result.project.id)
    expect(createOwnedProject).toHaveBeenCalledWith("user-1", {
      workspace: "Operations",
      project: "Operations",
    })
  })

  it("rotates a write key through one credential operation", async () => {
    const createApiKey = vi.fn(projectCredentials().createApiKey)
    const revokeApiKey = vi.fn(() => Effect.succeed(true))
    const rotateWriteKey = vi.fn(projectCredentials().rotateWriteKey)
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        manage.rotateWriteKey("user-1", "project-1", "key-old"),
      ).pipe(
        Effect.provide(
          provide(
            projectCredentials({ createApiKey, revokeApiKey, rotateWriteKey }),
          ),
        ),
      ),
    )
    expect(result).toMatchObject({
      id: "key-rotated",
      name: "Worker",
      secret: "fm_write_secret",
    })
    expect(rotateWriteKey).toHaveBeenCalledWith("project-1", "key-old")
    expect(createApiKey).not.toHaveBeenCalled()
    expect(revokeApiKey).not.toHaveBeenCalled()
  })

  it("does not create a replacement when rotation is refused", async () => {
    const createApiKey = vi.fn(projectCredentials().createApiKey)
    const rotateWriteKey = vi.fn(() => Effect.succeed(null))
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        Effect.result(manage.rotateWriteKey("user-1", "project-1", "key-old")),
      ).pipe(
        Effect.provide(
          provide(projectCredentials({ createApiKey, rotateWriteKey })),
        ),
      ),
    )
    expectLeft(result, { _tag: "InvalidInput" })
    expect(createApiKey).not.toHaveBeenCalled()
    expect(rotateWriteKey).toHaveBeenCalledOnce()
  })

  it("does not rotate a key for a project the user cannot access", async () => {
    const rotateWriteKey = vi.fn(projectCredentials().rotateWriteKey)
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        Effect.result(manage.rotateWriteKey("user-1", "project-1", "key-old")),
      ).pipe(
        Effect.provide(
          provide(
            projectCredentials({
              memberProject: () => Effect.succeed(undefined),
              rotateWriteKey,
            }),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized" })
    expect(rotateWriteKey).not.toHaveBeenCalled()
  })

  it("rejects browser keys without an http origin", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        Effect.result(
          manage.createBrowserKey("user-1", "project-1", {
            name: "Web",
            origins: ["localhost:3000"],
          }),
        ),
      ).pipe(Effect.provide(provide())),
    )
    expectLeft(result, { _tag: "InvalidInput" })
  })
})

describe("Onboarding", () => {
  it("returns the persisted onboarding state", async () => {
    const onboardingState = vi.fn(() =>
      Effect.succeed({ step: "instrument" as const, completedAt: null }),
    )
    const result = await Effect.runPromise(
      Effect.flatMap(Onboarding, (onboarding) =>
        onboarding.state("user-1"),
      ).pipe(
        Effect.provide(
          provideOnboarding(projectCredentials({ onboardingState })),
        ),
      ),
    )

    expect(result).toEqual({ step: "instrument", completedAt: null })
    expect(onboardingState).toHaveBeenCalledWith("user-1")
  })

  it("requires a project before advancing", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(Onboarding, (onboarding) =>
        Effect.result(onboarding.advance("user-1", "key")),
      ).pipe(
        Effect.provide(
          provideOnboarding(
            projectCredentials({
              projectForUser: () => Effect.succeed(undefined),
            }),
          ),
        ),
      ),
    )

    expectLeft(result, { _tag: "InvalidInput" })
  })

  it("requires a write key before completing", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(Onboarding, (onboarding) =>
        Effect.result(onboarding.complete("user-1")),
      ).pipe(
        Effect.provide(
          provideOnboarding(
            projectCredentials({ listApiKeys: () => Effect.succeed([]) }),
          ),
        ),
      ),
    )

    expectLeft(result, { _tag: "InvalidInput" })
  })
})
