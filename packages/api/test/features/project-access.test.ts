import { Effect, Result, Layer, Redacted } from "effect"
import {
  InvalidInput,
  ManagementRateLimited,
  Unauthorized,
} from "../../src/errors.js"
import { describe, expect, it, vi } from "vitest"
import { ApiSettings } from "../../src/config"
import { AuthorizeProject } from "../../src/features/project-access/use-cases/authorize-project"
import { ManageProject } from "../../src/features/project-access/use-cases/manage-project"
import { Onboarding } from "../../src/features/project-access/use-cases/onboarding"
import {
  ProjectCredentials,
  type ProjectCredentialsService,
} from "../../src/features/project-access/ports/project-credentials"
const expectLeft = (
  result: Result.Result<unknown, unknown>,
  ErrorClass: abstract new (...args: never[]) => object,
  fields?: object,
) =>
  Result.match(result, {
    onFailure: (error) => {
      expect(error).toBeInstanceOf(ErrorClass)
      if (fields) {
        expect(error).toMatchObject(fields)
      }
    },
    onSuccess: () => expect.fail("expected a failure"),
  })

function projectCredentials(
  overrides: Partial<ProjectCredentialsService> = {},
) {
  return ProjectCredentials.of({
    consumeCreationQuota: () =>
      Effect.succeed({ allowed: true, retryAfter: null }),
    authenticateBrowser: () => Effect.succeed(undefined),
    browserOriginAllowed: () => Effect.succeed(false),
    consumeBrowserQuota: () => Effect.succeed(false),
    authenticate: () => Effect.succeed("project-1"),
    projectForUser: () => Effect.succeed("project-1"),
    memberProject: () => Effect.succeed("project-1"),
    delegatedReaderProject: () => Effect.succeed("project-1"),
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
        createdAt: "2026-10-25T00:00:00.000Z",
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
        createdAt: "2026-10-26T15:04:05.000Z",
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
        mcpResourceUrl: undefined,
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
  it("issues read keys only after membership and key-creation admission", async () => {
    const createApiKey = vi.fn(() =>
      Effect.succeed({
        id: "read",
        name: "CLI",
        prefix: "fm_read_test",
        secret: "fm_read_secret",
      }),
    )
    const credentials = projectCredentials({ createApiKey })
    const create = Effect.flatMap(ManageProject, (manage) =>
      manage.createReadKey("user", "project-1", "CLI"),
    )
    await Effect.runPromise(create.pipe(Effect.provide(provide(credentials))))
    expect(createApiKey).toHaveBeenCalledWith("user", "project-1", {
      name: "CLI",
      permission: "read",
    })
    createApiKey.mockClear()
    const denied = projectCredentials({
      createApiKey,
      memberProject: () => Effect.succeed(undefined),
    })
    expectLeft(
      await Effect.runPromise(
        Effect.result(create).pipe(Effect.provide(provide(denied))),
      ),
      Unauthorized,
    )
    expect(createApiKey).not.toHaveBeenCalled()
    const limited = projectCredentials({
      createApiKey,
      consumeCreationQuota: () =>
        Effect.succeed({ allowed: false, retryAfter: 8 }),
    })
    expectLeft(
      await Effect.runPromise(
        Effect.result(create).pipe(Effect.provide(provide(limited))),
      ),
      ManagementRateLimited,
    )
    expect(createApiKey).not.toHaveBeenCalled()
  })

  it("denies creation and rotation before writes when the actor budget is exhausted, while allowing revocation", async () => {
    const createProject = vi.fn(projectCredentials().createProject)
    const createApiKey = vi.fn(projectCredentials().createApiKey)
    const createBrowserKey = vi.fn(projectCredentials().createBrowserKey)
    const rotateWriteKey = vi.fn(projectCredentials().rotateWriteKey)
    const credentials = projectCredentials({
      consumeCreationQuota: () =>
        Effect.succeed({ allowed: false, retryAfter: 42 }),
      createProject,
      createApiKey,
      createBrowserKey,
      rotateWriteKey,
    })
    await Effect.runPromise(
      Effect.gen(function* () {
        const manage = yield* ManageProject
        for (const operation of [
          manage.create("user-1", "Project").pipe(Effect.asVoid),
          manage
            .createWriteKey("user-1", "project-1", "Key")
            .pipe(Effect.asVoid),
          manage
            .createBrowserKey("user-1", "project-1", {
              name: "Browser",
              origins: ["http://localhost"],
            })
            .pipe(Effect.asVoid),
          manage
            .rotateWriteKey("user-1", "project-1", "key-1")
            .pipe(Effect.asVoid),
        ]) {
          expectLeft(yield* Effect.result(operation), ManagementRateLimited, {
            retryAfter: 42,
          })
        }
        yield* manage.revokeApiKey("user-1", "project-1", "key-1")
        yield* manage.revokeBrowserKey("user-1", "project-1", "browser-1")
      }).pipe(Effect.provide(provide(credentials))),
    )
    for (const write of [
      createProject,
      createApiKey,
      createBrowserKey,
      rotateWriteKey,
    ]) {
      expect(write).not.toHaveBeenCalled()
    }
  })

  it("creates a project in the existing workspace", async () => {
    const createProject = vi.fn(projectCredentials().createProject)
    const result = await Effect.runPromise(
      Effect.flatMap(ManageProject, (manage) =>
        manage.create("user-1", "  Staging  "),
      ).pipe(Effect.provide(provide(projectCredentials({ createProject })))),
    )
    expect(result.project.name).toBe("Staging")
    expect(result.project.createdAt).toBe("2026-10-26T15:04:05.000Z")
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
    expectLeft(result, InvalidInput)
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
    expect(memberProject).toHaveBeenCalledWith("user-1", "project-1", "owner")
    expect(createApiKey).toHaveBeenCalledWith("user-1", "project-1", {
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
    expect(result.project.createdAt).toBe("2026-10-25T00:00:00.000Z")
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
    expect(rotateWriteKey).toHaveBeenCalledWith(
      "user-1",
      "project-1",
      "key-old",
    )
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
    expectLeft(result, InvalidInput)
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
    expectLeft(result, Unauthorized)
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
    expectLeft(result, InvalidInput)
  })
})

describe("Onboarding", () => {
  it.each(["install", "instrument", "run"] as const)(
    "rejects advancing to %s with read keys only",
    async (step) => {
      const update = vi.fn(() => Effect.void)
      const result = await Effect.runPromise(
        Effect.flatMap(Onboarding, (onboarding) =>
          onboarding.advance("user-1", step, "project-1"),
        ).pipe(
          Effect.provide(
            provideOnboarding(
              projectCredentials({
                listApiKeys: () =>
                  Effect.succeed([
                    {
                      id: "read",
                      name: "Read",
                      prefix: "fm_read",
                      permission: "read",
                      createdAt: "2026-11-15T00:00:00Z",
                    },
                  ]),
                updateOnboardingState: update,
              }),
            ),
          ),
          Effect.result,
        ),
      )
      expectLeft(result, InvalidInput)
      expect(update).not.toHaveBeenCalled()
    },
  )

  it("binds eligibility and completion to the selected owned project without requiring an event", async () => {
    const arbitrary = vi.fn(() => Effect.succeed("wrong-project"))
    const member = vi.fn((_user: string, projectId: string) =>
      Effect.succeed(projectId),
    )
    const list = vi.fn(() =>
      Effect.succeed([
        {
          id: "write",
          name: "Write",
          prefix: "fm_write",
          permission: "write" as const,
          createdAt: "2026-11-15T00:00:00Z",
        },
      ]),
    )
    const update = vi.fn(() => Effect.void)
    await Effect.runPromise(
      Effect.gen(function* () {
        const onboarding = yield* Onboarding
        yield* onboarding.advance("user-1", "run", "selected-project")
        yield* onboarding.complete("user-1", "selected-project")
      }).pipe(
        Effect.provide(
          provideOnboarding(
            projectCredentials({
              projectForUser: arbitrary,
              memberProject: member,
              listApiKeys: list,
              updateOnboardingState: update,
            }),
          ),
        ),
      ),
    )
    expect(arbitrary).not.toHaveBeenCalled()
    expect(member).toHaveBeenCalledWith("user-1", "selected-project", "owner")
    expect(list).toHaveBeenCalledWith("user-1", "selected-project")
    expect(update).toHaveBeenLastCalledWith("user-1", "run", expect.any(Date))
  })

  it("requires an explicit selection and never falls back to another project's key", async () => {
    const fallback = vi.fn(() => Effect.succeed("another-owned-project"))
    const result = await Effect.runPromise(
      Effect.flatMap(Onboarding, (onboarding) =>
        onboarding.advance("user-1", "key"),
      ).pipe(
        Effect.provide(
          provideOnboarding(projectCredentials({ projectForUser: fallback })),
        ),
        Effect.result,
      ),
    )
    expectLeft(result, InvalidInput)
    expect(fallback).not.toHaveBeenCalled()
  })

  it("does not complete setup using a read key", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(Onboarding, (onboarding) =>
        onboarding.complete("user-1", "project-1"),
      ).pipe(
        Effect.provide(
          provideOnboarding(
            projectCredentials({
              listApiKeys: () =>
                Effect.succeed([
                  {
                    id: "read",
                    name: "Read",
                    prefix: "fm_read",
                    permission: "read",
                    createdAt: "2026-11-15T00:00:00Z",
                  },
                ]),
            }),
          ),
        ),
        Effect.result,
      ),
    )
    expectLeft(result, InvalidInput)
  })

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
        Effect.result(onboarding.advance("user-1", "key", "project-1")),
      ).pipe(
        Effect.provide(
          provideOnboarding(
            projectCredentials({
              memberProject: () => Effect.succeed(undefined),
            }),
          ),
        ),
      ),
    )

    expectLeft(result, InvalidInput)
  })

  it("requires a write key before completing", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(Onboarding, (onboarding) =>
        Effect.result(onboarding.complete("user-1", "project-1")),
      ).pipe(
        Effect.provide(
          provideOnboarding(
            projectCredentials({ listApiKeys: () => Effect.succeed([]) }),
          ),
        ),
      ),
    )

    expectLeft(result, InvalidInput)
  })
})
