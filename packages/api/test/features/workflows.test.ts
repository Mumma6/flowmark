import { Effect, Either, Layer, Redacted } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DEMO_WRITE_KEY,
  DIAGNOSTICS_WRITE_KEY,
  DIAGNOSTICS_BROWSER_KEY,
} from "@flowmark/db/demo"
import { PersistenceError, RunNotFound } from "../../src/errors"
import { ApiSettings } from "../../src/config"
import { AuthorizeProject } from "../../src/features/project-access/use-cases/authorize-project"
import { IngestWorkflowEvents } from "../../src/features/workflows/use-cases/ingest-events"
import { IngestBrowserWorkflowEvents } from "../../src/features/workflows/use-cases/ingest-browser-events"
import { GetProjectWorkflowData } from "../../src/features/workflows/use-cases/get-project-workflow-data"
import {
  WorkflowRepository,
  type WorkflowRepositoryService,
} from "../../src/features/workflows/ports/workflow-repository"
import {
  ProjectCredentials,
  type ProjectCredentialsService,
} from "../../src/features/project-access/ports/project-credentials"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

const expectLeft = <E>(
  result: Either.Either<unknown, E>,
  expected: unknown,
) =>
  Either.match(result, {
    onLeft: (error) => expect(error).toMatchObject(expected as object),
    onRight: () => expect.fail("expected a failure"),
  })

const input = {
  eventId: "00000000-0000-4000-8000-000000000003",
  event: {
    type: "started",
    workflow: "test",
    runId: "test-run",
    timestamp: "2026-10-23T12:00:00.000Z",
  },
}

function repository(overrides: Partial<WorkflowRepositoryService> = {}) {
  return WorkflowRepository.of({
    append: () => Effect.void,
    snapshot: () =>
      Effect.succeed({
        runs: [],
        workflows: [],
        metrics: {
          totalRuns: 0,
          failedRuns: 0,
          successRate: null,
          medianDurationMs: 0,
          p95DurationMs: 0,
        },
        daily: [],
        operations: [],
        failureCodes: [],
      }),
    listRuns: () =>
      Effect.succeed({
        runs: [],
        nextCursor: null,
        total: 0,
        limit: 50,
      }),
    timeline: () => Effect.succeed([]),
    related: () => Effect.succeed({ parentMatches: [], related: [] }),
    compare: () =>
      Effect.succeed({
        current: null,
        peers: [],
        peerSuccessRate: null,
        peerMedianDurationMs: null,
        peerP95DurationMs: null,
        operations: [],
      }),
    ...overrides,
  })
}

function projectCredentials(
  overrides: Partial<ProjectCredentialsService> = {},
) {
  return ProjectCredentials.of({
    authenticateBrowser: () => Effect.succeed(undefined),
    browserOriginAllowed: () => Effect.succeed(false),
    consumeBrowserQuota: () => Effect.succeed(false),
    authenticate: () => Effect.succeed("project-from-key"),
    projectForUser: () => Effect.succeed("project-from-key"),
    memberProject: () => Effect.succeed("project-from-key"),
    listProjects: () => Effect.succeed([]),
    workspaceForUser: () => Effect.succeed("workspace-from-key"),
    addOwner: () => Effect.void,
    createProject: () =>
      Effect.succeed({
        projectId: "project-from-key",
        writeKey: {
          id: "key-1",
          name: "Write key",
          prefix: "fm_write_test123",
          secret: "fm_write_test_secret",
        },
      }),
    renameProject: () => Effect.void,
    listApiKeys: () => Effect.succeed([]),
    listBrowserKeys: () => Effect.succeed([]),
    createApiKey: () =>
      Effect.succeed({
        id: "key-1",
        name: "Write key",
        prefix: "fm_write_test123",
        secret: "fm_write_test_secret",
      }),
    revokeApiKey: () => Effect.succeed(true),
    createBrowserKey: () =>
      Effect.succeed({
        id: "key-2",
        name: "Browser key",
        prefix: "fm_browser_test12",
        secret: "fm_browser_test_secret",
      }),
    revokeBrowserKey: () => Effect.succeed(true),
    createOwnedProject: () =>
      Effect.succeed({
        projectId: "project-from-key",
        writeKey: "fm_write_test",
        readKey: "fm_read_test",
      }),
    ...overrides,
  })
}

function dependencies(
  store = repository(),
  demoMode = true,
  credentials = projectCredentials(),
) {
  return AuthorizeProject.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(WorkflowRepository, store),
        Layer.succeed(ProjectCredentials, credentials),
      ),
    ),
    Layer.provide(
      Layer.succeed(ApiSettings, {
        databaseUrl: Redacted.make("postgresql://unused"),
        demoMode,
      }),
    ),
  )
}

describe("API Effect services", () => {
  it("rejects the local diagnostic write key outside demo mode before storage access", async () => {
    const authenticate = vi.fn(projectCredentials().authenticate)
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        Effect.either(
          service.authorize(`Bearer ${DIAGNOSTICS_WRITE_KEY}`, "write"),
        ),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            false,
            projectCredentials({ authenticate }),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized" })
    expect(authenticate).not.toHaveBeenCalled()
  })

  it("rejects the local diagnostic browser key outside demo mode before storage or body access", async () => {
    const authenticateBrowser = vi.fn(projectCredentials().authenticateBrowser)
    const body = vi.fn(() => input)
    const result = await Effect.runPromise(
      Effect.flatMap(IngestBrowserWorkflowEvents, (service) =>
        Effect.either(
          service.ingest(
            `Bearer ${DIAGNOSTICS_BROWSER_KEY}`,
            "http://localhost:3004",
            Effect.sync(body),
          ),
        ),
      ).pipe(
        Effect.provide(
          IngestBrowserWorkflowEvents.layer.pipe(
            Layer.provide(
              Layer.mergeAll(
                Layer.succeed(WorkflowRepository, repository()),
                Layer.succeed(
                  ProjectCredentials,
                  projectCredentials({ authenticateBrowser }),
                ),
                Layer.succeed(ApiSettings, {
                  databaseUrl: Redacted.make("postgresql://unused"),
                  demoMode: false,
                }),
              ),
            ),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "BrowserUnauthorized" })
    expect(authenticateBrowser).not.toHaveBeenCalled()
    expect(body).not.toHaveBeenCalled()
  })

  it("keeps ingestion lazy and persists under the authorized project", async () => {
    const append = vi.fn(repository().append)
    const body = vi.fn(() => input)
    const operation = Effect.flatMap(IngestWorkflowEvents, (service) =>
      service.ingest("Bearer write-key", Effect.sync(body)),
    ).pipe(
      Effect.provide(
        IngestWorkflowEvents.layer.pipe(
          Layer.provide(dependencies(repository({ append }))),
        ),
      ),
    )

    expect(append).not.toHaveBeenCalled()
    expect(body).not.toHaveBeenCalled()
    await Effect.runPromise(operation)
    expect(append).toHaveBeenCalledExactlyOnceWith(
      "project-from-key",
      input.eventId,
      input.event,
    )
  })

  it("authorizes before reading untrusted request data", async () => {
    const body = vi.fn(() => input)
    const append = vi.fn(repository().append)
    const result = await Effect.runPromise(
      Effect.flatMap(IngestWorkflowEvents, (service) =>
        Effect.either(service.ingest(null, Effect.sync(body))),
      ).pipe(
        Effect.provide(
          IngestWorkflowEvents.layer.pipe(
            Layer.provide(dependencies(repository({ append }))),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized", permission: "write" })
    expect(body).not.toHaveBeenCalled()
    expect(append).not.toHaveBeenCalled()
  })

  it("rejects public demo credentials before touching storage when demo mode is off", async () => {
    const authenticate = vi.fn(projectCredentials().authenticate)
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        Effect.either(service.authorize(`Bearer ${DEMO_WRITE_KEY}`, "write")),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            false,
            projectCredentials({ authenticate }),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized" })
    expect(authenticate).not.toHaveBeenCalled()
  })

  it("authorizes dashboard sessions from project membership", async () => {
    const projectForUser = vi.fn(() => Effect.succeed("owned-project"))
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        service.authorizeUser("user-1"),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            true,
            projectCredentials({ projectForUser }),
          ),
        ),
      ),
    )
    expect(result).toBe("owned-project")
    expect(projectForUser).toHaveBeenCalledWith("user-1")
  })

  it("authorizes a requested project only when the user is a member", async () => {
    const memberProject = vi.fn(() => Effect.succeed("requested-project"))
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        service.authorizeUser("user-1", "requested-project"),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            true,
            projectCredentials({ memberProject }),
          ),
        ),
      ),
    )
    expect(result).toBe("requested-project")
    expect(memberProject).toHaveBeenCalledWith("user-1", "requested-project")
  })

  it("rejects a requested project the user does not belong to", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        Effect.either(service.authorizeUser("user-1", "other-project")),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            true,
            projectCredentials({
              memberProject: () => Effect.succeed(undefined),
            }),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized", permission: "read" })
  })

  it("rejects a signed-in user without project membership", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        Effect.either(service.authorizeUser("user-1")),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            true,
            projectCredentials({
              projectForUser: () => Effect.succeed(undefined),
            }),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized", permission: "read" })
  })

  it("passes redacted keys and required permissions to storage", async () => {
    const authenticate = vi.fn(projectCredentials().authenticate)
    await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        service.authorize("Bearer read-key", "read"),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            true,
            projectCredentials({ authenticate }),
          ),
        ),
      ),
    )
    expect(authenticate).toHaveBeenCalledOnce()
    const [key, permission] = authenticate.mock.calls[0]
    expect(Redacted.value(key)).toBe("read-key")
    expect(permission).toBe("read")
  })

  it.each([
    { ...input, eventId: "invalid" },
    { ...input, event: { ...input.event, workflow: " " } },
    { ...input, event: { ...input.event, runId: "x".repeat(201) } },
    { ...input, event: { ...input.event, timestamp: "invalid" } },
    { ...input, event: { ...input.event, type: "step", step: "" } },
  ])("validates event boundaries before persistence: %j", async (invalid) => {
    const append = vi.fn(repository().append)
    const result = await Effect.runPromise(
      Effect.flatMap(IngestWorkflowEvents, (service) =>
        Effect.either(service.ingest("Bearer key", Effect.succeed(invalid))),
      ).pipe(
        Effect.provide(
          IngestWorkflowEvents.layer.pipe(
            Layer.provide(dependencies(repository({ append }))),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "InvalidInput", cause: expect.anything() })
    expect(append).not.toHaveBeenCalled()
  })

  it("preserves repository errors and their original causes", async () => {
    const cause = new Error("database unavailable")
    const error = new PersistenceError({ operation: "append-event", cause })
    const operation = Effect.flatMap(IngestWorkflowEvents, (service) =>
      Effect.either(service.ingest("Bearer key", Effect.succeed(input))),
    ).pipe(
      Effect.provide(
        IngestWorkflowEvents.layer.pipe(
          Layer.provide(
            dependencies(repository({ append: () => Effect.fail(error) })),
          ),
        ),
      ),
    )
    Either.match(await Effect.runPromise(operation), {
      onLeft: (failure) => {
        expect(failure).toBeInstanceOf(PersistenceError)
        expect(failure.cause).toBe(cause)
      },
      onRight: () => expect.fail("Expected persistence failure"),
    })
  })

  it("preserves missing-run failures for the HTTP conflict response", async () => {
    const error = new RunNotFound({ runId: "test-run" })
    const result = await Effect.runPromise(
      Effect.flatMap(IngestWorkflowEvents, (service) =>
        Effect.either(service.ingest("Bearer key", Effect.succeed(input))),
      ).pipe(
        Effect.provide(
          IngestWorkflowEvents.layer.pipe(
            Layer.provide(
              dependencies(repository({ append: () => Effect.fail(error) })),
            ),
          ),
        ),
      ),
    )
    expectLeft(result, error)
  })

  it("uses read authorization and project-scoped query methods", async () => {
    const timeline = vi.fn(repository().timeline)
    const snapshot = vi.fn(repository().snapshot)
    const operation = Effect.gen(function* () {
      const queries = yield* GetProjectWorkflowData
      yield* queries.snapshot("Bearer key")
      yield* queries.workflows("Bearer key")
      yield* queries.timeline("Bearer key", "run-id")
    }).pipe(
      Effect.provide(
        GetProjectWorkflowData.layer.pipe(
          Layer.provide(dependencies(repository({ timeline, snapshot }))),
        ),
      ),
    )
    await Effect.runPromise(operation)
    expect(snapshot).toHaveBeenCalledTimes(2)
    expect(snapshot).toHaveBeenCalledWith("project-from-key")
    expect(timeline).toHaveBeenCalledExactlyOnceWith(
      "project-from-key",
      "run-id",
    )
  })

  it("does not query another project after authorization fails", async () => {
    const timeline = vi.fn(repository().timeline)
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        Effect.either(queries.timeline("Bearer bad-key", "run-id")),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ timeline }),
                true,
                projectCredentials({
                  authenticate: () => Effect.succeed(undefined),
                }),
              ),
            ),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized" })
    expect(timeline).not.toHaveBeenCalled()
  })
})
