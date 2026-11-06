import { Effect, Result, Layer, Redacted } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  DEMO_READ_KEY,
  DEMO_WRITE_KEY,
  DIAGNOSTICS_WRITE_KEY,
  DIAGNOSTICS_BROWSER_KEY,
} from "@flowmark/db/demo"
import {
  DatabaseError,
  DatabaseOperation,
  InvalidResultQuery,
  WorkflowStore,
  type WorkflowStoreService,
} from "@flowmark/db/persistence"
import { PersistenceError, RunNotFound } from "../../src/errors"
import { WorkflowRepositoryLive } from "../../src/features/workflows/adapters/workflow-repository"
import { ApiSettings } from "../../src/config"
import {
  AgentAccess,
  type AgentAccessService,
} from "../../src/features/project-access/ports/agent-access"
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
const expectLeft = <E>(result: Result.Result<unknown, E>, expected: unknown) =>
  Result.match(result, {
    onFailure: (error) => expect(error).toMatchObject(expected as object),
    onSuccess: () => expect.fail("expected a failure"),
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
    expectations: () =>
      Effect.succeed({
        asOf: new Date(0).toISOString(),
        expectations: [],
        unmatched: [],
        unavailableCount: 0,
      }),
    businessInsights: () => Effect.die("Not used by this fixture"),
    append: () => Effect.succeed("recorded"),
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
    workflows: () => Effect.succeed([]),
    listRuns: () =>
      Effect.succeed({
        runs: [],
        nextCursor: null,
        total: 0,
        limit: 50,
      }),
    search: () => Effect.succeed({ workflows: [], runs: [], references: [] }),
    timeline: () => Effect.succeed([]),
    runEventPage: () =>
      Effect.succeed({
        runId: "run-id",
        events: [],
        nextCursor: null,
        limit: 50,
        totalEvents: 0,
      }),
    runInvestigationSummary: () =>
      Effect.succeed({
        id: "run-id",
        externalId: "ext",
        workflow: "wf",
        status: "Completed" as const,
        startedAt: "2026-10-23T12:00:00.000Z",
        durationMs: 1,
        step: null,
        outcome: null,
        environment: null,
        release: null,
        correlationId: null,
        parentRunId: null,
        eventCount: 0,
        operationCount: 0,
        errorCount: 0,
        reportCount: 0,
      }),
    relatedRunsPage: () =>
      Effect.succeed({
        runId: "run-id",
        items: [],
        nextCursor: null,
        limit: 25,
        totalLinks: 0,
      }),
    expectationsPage: () =>
      Effect.succeed({
        runId: "run-id",
        asOf: new Date(0).toISOString(),
        expectations: [],
        unmatched: [],
        nextCursor: null,
        limit: 25,
        totalRecords: 0,
        unavailableCount: 0,
      }),
    operationsPage: () =>
      Effect.succeed({
        runId: "run-id",
        operations: [],
        nextCursor: null,
        limit: 25,
        totalOperations: 0,
      }),
    discoverWorkflows: () =>
      Effect.succeed({
        workflows: [],
        nextCursor: null,
        limit: 25,
        total: 0,
        applied: {
          projectId: "project-from-key",
          workflow: null,
          revision: null,
          cursor: null,
          limit: 25,
        },
        omissions: { continued: false, truncatedRecords: 0 },
        capabilities: {
          reads: ["workflows", "revisions", "searchFields"],
          mutations: [],
          unsupportedFilters: ["environment", "status", "release", "aggregate"],
        },
      }),
    discoverWorkflowMeaning: () =>
      Effect.succeed({
        workflow: "import",
        revisions: [],
        searchFields: [],
        lookupKeys: [],
        dimensionKeys: [],
        nextCursor: null,
        limit: 25,
        totalRevisions: 0,
        applied: {
          projectId: "project-from-key",
          workflow: "import",
          revision: null,
          cursor: null,
          limit: 25,
        },
        omissions: { continued: false, truncatedRecords: 0 },
        capabilities: {
          reads: ["workflows", "revisions", "searchFields"],
          mutations: [],
          unsupportedFilters: ["environment", "status", "release", "aggregate"],
        },
      }),
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
    intelligence: () =>
      Effect.succeed({
        workflow: null,
        current: {
          startedAfter: "2026-10-23T00:00:00.000Z",
          startedBefore: "2026-10-24T00:00:00.000Z",
          totalRuns: 0,
          finishedRuns: 0,
          completedRuns: 0,
          failedRuns: 0,
          successRate: null,
          medianDurationMs: null,
          p95DurationMs: null,
        },
        previous: {
          startedAfter: "2026-10-22T00:00:00.000Z",
          startedBefore: "2026-10-23T00:00:00.000Z",
          totalRuns: 0,
          finishedRuns: 0,
          completedRuns: 0,
          failedRuns: 0,
          successRate: null,
          medianDurationMs: null,
          p95DurationMs: null,
        },
        operations: [],
        failureCodes: [],
      }),
    periodReport: () =>
      Effect.succeed({
        workflow: null,
        current: {
          startedAfter: "2026-10-21T00:00:00.000Z",
          startedBefore: "2026-10-28T00:00:00.000Z",
          totalRuns: 0,
          finishedRuns: 0,
          completedRuns: 0,
          failedRuns: 0,
          successRate: null,
          medianDurationMs: null,
          p95DurationMs: null,
        },
        previous: {
          startedAfter: "2026-10-14T00:00:00.000Z",
          startedBefore: "2026-10-21T00:00:00.000Z",
          totalRuns: 0,
          finishedRuns: 0,
          completedRuns: 0,
          failedRuns: 0,
          successRate: null,
          medianDurationMs: null,
          p95DurationMs: null,
        },
        daily: [],
        workflowNames: [],
        workflows: [],
        failureGroups: [],
        failureGroupsTruncated: false,
        operations: [],
      }),
    ...overrides,
  })
}

function projectCredentials(
  overrides: Partial<ProjectCredentialsService> = {},
) {
  return ProjectCredentials.of({
    consumeCreationQuota: () =>
      Effect.succeed({ allowed: true, retryAfter: null }),
    authenticateBrowser: () => Effect.succeed(undefined),
    browserOriginAllowed: () => Effect.succeed(false),
    consumeBrowserQuota: () => Effect.succeed(false),
    authenticate: () => Effect.succeed("project-from-key"),
    projectForUser: () => Effect.succeed("project-from-key"),
    memberProject: () => Effect.succeed("project-from-key"),
    delegatedReaderProject: () => Effect.succeed("project-from-key"),
    listProjects: () => Effect.succeed([]),
    workspaceForUser: () => Effect.succeed("workspace-from-key"),
    onboardingState: () =>
      Effect.succeed({ step: "project" as const, completedAt: null }),
    updateOnboardingState: () => Effect.void,
    createProject: () =>
      Effect.succeed({
        projectId: "project-from-key",
        createdAt: "2026-10-25T00:00:00.000Z",
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
    rotateWriteKey: () =>
      Effect.succeed({
        id: "key-rotated",
        name: "Write key",
        prefix: "fm_write_test123",
        secret: "fm_write_test_secret",
      }),
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
        createdAt: "2026-10-25T00:00:00.000Z",
        writeKey: {
          id: "key-owned",
          name: "Write key",
          prefix: "fm_write_test123",
          secret: "fm_write_test_secret",
        },
      }),
    ...overrides,
  })
}

function agentAccess(overrides: Partial<AgentAccessService> = {}) {
  return AgentAccess.of({
    listConnections: () => Effect.succeed([]),
    getConnection: () => Effect.succeed(undefined),
    submitConsent: () => Effect.succeed("authorization-code-id"),
    recordLastAuthenticated: () => Effect.void,
    ...overrides,
  })
}

function dependencies(
  store = repository(),
  demoMode = true,
  credentials = projectCredentials(),
  access = agentAccess(),
) {
  return AuthorizeProject.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        Layer.succeed(WorkflowRepository, store),
        Layer.succeed(ProjectCredentials, credentials),
        Layer.succeed(AgentAccess, access),
      ),
    ),
    Layer.provide(
      Layer.succeed(ApiSettings, {
        databaseUrl: Redacted.make("postgresql://unused"),
        demoMode,
        mcpResourceUrl: undefined,
      }),
    ),
  )
}

describe("API Effect services", () => {
  it("rejects the local diagnostic write key outside demo mode before storage access", async () => {
    const authenticate = vi.fn(projectCredentials().authenticate)
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        Effect.result(
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
        Effect.result(
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
                  mcpResourceUrl: undefined,
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
        Effect.result(service.ingest(null, Effect.sync(body))),
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

  it.each([
    [DEMO_READ_KEY, "read"],
    [DEMO_WRITE_KEY, "write"],
    [DIAGNOSTICS_WRITE_KEY, "write"],
  ] as const)(
    "rejects %s before touching storage when demo mode is off",
    async (key, permission) => {
      const authenticate = vi.fn(projectCredentials().authenticate)
      const result = await Effect.runPromise(
        Effect.flatMap(AuthorizeProject, (service) =>
          Effect.result(service.authorize(`Bearer ${key}`, permission)),
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
    },
  )

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

  it("keeps business insight reads behind user project membership", async () => {
    const businessInsights = vi.fn(() =>
      Effect.die("Must not read another project"),
    )
    const query = {
      workflow: "import",
      revision: "v1",
      path: ["saved"],
      currentStartedAfter: "2026-10-20T00:00:00.000Z",
      currentStartedBefore: "2026-10-27T00:00:00.000Z",
      previousStartedAfter: "2026-10-13T00:00:00.000Z",
      previousStartedBefore: "2026-10-20T00:00:00.000Z",
    }
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        Effect.result(
          service.businessInsights(
            { _tag: "User", userId: "user-1", projectId: "foreign-project" },
            query,
          ),
        ),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ businessInsights }),
                true,
                projectCredentials({
                  memberProject: () => Effect.succeed(undefined),
                }),
              ),
            ),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized", permission: "read" })
    expect(businessInsights).not.toHaveBeenCalled()
  })

  it("keeps period reports behind user project membership", async () => {
    const periodReport = vi.fn(() =>
      Effect.die("Must not read another project"),
    )
    const query = {
      workflow: "import",
      currentStartedAfter: "2026-10-21T00:00:00.000Z",
      currentStartedBefore: "2026-10-28T00:00:00.000Z",
      previousStartedAfter: "2026-10-14T00:00:00.000Z",
      previousStartedBefore: "2026-10-21T00:00:00.000Z",
    }
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        Effect.result(
          service.periodReport(
            { _tag: "User", userId: "user-1", projectId: "foreign-project" },
            query,
          ),
        ),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ periodReport }),
                true,
                projectCredentials({
                  memberProject: () => Effect.succeed(undefined),
                }),
              ),
            ),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized", permission: "read" })
    expect(periodReport).not.toHaveBeenCalled()
  })

  it("rejects a period report window before reading", async () => {
    const periodReport = vi.fn(() =>
      Effect.die("Must not query an invalid window"),
    )
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        Effect.result(
          service.periodReport(
            { _tag: "User", userId: "user-1" },
            {
              currentStartedAfter: "2026-10-01T00:00:00.000Z",
              currentStartedBefore: "2026-12-01T00:00:00.000Z",
              previousStartedAfter: "2026-09-01T00:00:00.000Z",
              previousStartedBefore: "2026-10-01T00:00:00.000Z",
            },
          ),
        ),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(dependencies(repository({ periodReport }), true)),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "InvalidInput" })
    expect(periodReport).not.toHaveBeenCalled()
  })

  it("reads a period report only after the caller is a project member", async () => {
    const query = {
      currentStartedAfter: "2026-10-21T00:00:00.000Z",
      currentStartedBefore: "2026-10-28T00:00:00.000Z",
      previousStartedAfter: "2026-10-14T00:00:00.000Z",
      previousStartedBefore: "2026-10-21T00:00:00.000Z",
    }
    const periodReport = vi.fn(() =>
      Effect.succeed({
        workflow: null,
        current: {
          ...query,
          startedAfter: query.currentStartedAfter,
          startedBefore: query.currentStartedBefore,
          totalRuns: 1,
          finishedRuns: 1,
          completedRuns: 1,
          failedRuns: 0,
          successRate: 100,
          medianDurationMs: 1,
          p95DurationMs: 1,
        },
        previous: {
          startedAfter: query.previousStartedAfter,
          startedBefore: query.previousStartedBefore,
          totalRuns: 0,
          finishedRuns: 0,
          completedRuns: 0,
          failedRuns: 0,
          successRate: null,
          medianDurationMs: null,
          p95DurationMs: null,
        },
        daily: [],
        workflowNames: [],
        workflows: [],
        failureGroups: [],
        failureGroupsTruncated: false,
        operations: [],
      }),
    )
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        service.periodReport({ _tag: "User", userId: "user-1" }, query),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(dependencies(repository({ periodReport }), true)),
          ),
        ),
      ),
    )
    expect(result.current.totalRuns).toBe(1)
    expect(periodReport).toHaveBeenCalledWith("project-from-key", query)
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
        Effect.result(service.authorizeUser("user-1", "other-project")),
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
        Effect.result(service.authorizeUser("user-1")),
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

  it("authorizes a delegated reader only when grant and membership intersect", async () => {
    const delegatedReaderProject = vi.fn(() => Effect.succeed("grant-project"))
    const input = {
      userId: "user-1",
      clientId: "client-1",
      authorizationCodeId: "auth-family-1",
      projectId: "grant-project",
    }
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        service.authorizeDelegatedReader(input),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            true,
            projectCredentials({ delegatedReaderProject }),
          ),
        ),
      ),
    )
    expect(result).toBe("grant-project")
    expect(delegatedReaderProject).toHaveBeenCalledWith(input)
  })

  it("rejects a delegated reader when the grant does not cover the project", async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(AuthorizeProject, (service) =>
        Effect.result(
          service.authorizeDelegatedReader({
            userId: "user-1",
            clientId: "client-1",
            authorizationCodeId: "auth-family-1",
            projectId: "not-on-grant",
          }),
        ),
      ).pipe(
        Effect.provide(
          dependencies(
            repository(),
            true,
            projectCredentials({
              delegatedReaderProject: () => Effect.succeed(undefined),
            }),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized", permission: "read" })
  })

  it("keeps workflow reads behind delegated grant intersection", async () => {
    const snapshot = vi.fn(repository().snapshot)
    const delegatedReaderProject = vi.fn(() => Effect.succeed("p-delegated"))
    const recordLastAuthenticated = vi.fn(() => Effect.void)
    await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        service.snapshot({
          _tag: "DelegatedUser",
          userId: "user-1",
          clientId: "client-1",
          authorizationCodeId: "fam-1",
          projectId: "p-delegated",
        }),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ snapshot }),
                true,
                projectCredentials({ delegatedReaderProject }),
                agentAccess({ recordLastAuthenticated }),
              ),
            ),
          ),
        ),
      ),
    )
    expect(delegatedReaderProject).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "client-1",
      authorizationCodeId: "fam-1",
      projectId: "p-delegated",
    })
    expect(snapshot).toHaveBeenCalledWith("p-delegated")
    expect(recordLastAuthenticated).toHaveBeenCalledWith({
      userId: "user-1",
      clientId: "client-1",
      authorizationCodeId: "fam-1",
      at: expect.any(Date),
    })
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
        Effect.result(service.ingest("Bearer key", Effect.succeed(invalid))),
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
      Effect.result(service.ingest("Bearer key", Effect.succeed(input))),
    ).pipe(
      Effect.provide(
        IngestWorkflowEvents.layer.pipe(
          Layer.provide(
            dependencies(repository({ append: () => Effect.fail(error) })),
          ),
        ),
      ),
    )
    Result.match(await Effect.runPromise(operation), {
      onFailure: (failure) => {
        expect(failure).toBeInstanceOf(PersistenceError)
        expect(failure.cause).toBe(cause)
      },
      onSuccess: () => expect.fail("Expected persistence failure"),
    })
  })

  it("preserves missing-run failures for the HTTP conflict response", async () => {
    const error = new RunNotFound({ runId: "test-run" })
    const result = await Effect.runPromise(
      Effect.flatMap(IngestWorkflowEvents, (service) =>
        Effect.result(service.ingest("Bearer key", Effect.succeed(input))),
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
    const workflows = vi.fn(repository().workflows)
    const operation = Effect.gen(function* () {
      const queries = yield* GetProjectWorkflowData
      const reader = { _tag: "Key" as const, header: "Bearer key" }
      yield* queries.snapshot(reader)
      yield* queries.workflows(reader)
      yield* queries.timeline(reader, "run-id")
    }).pipe(
      Effect.provide(
        GetProjectWorkflowData.layer.pipe(
          Layer.provide(
            dependencies(repository({ timeline, snapshot, workflows })),
          ),
        ),
      ),
    )
    await Effect.runPromise(operation)
    expect(snapshot).toHaveBeenCalledExactlyOnceWith("project-from-key")
    expect(workflows).toHaveBeenCalledExactlyOnceWith("project-from-key")
    expect(timeline).toHaveBeenCalledExactlyOnceWith(
      "project-from-key",
      "run-id",
    )
  })

  it("lists workflow summaries without loading the snapshot", async () => {
    const summaries = [
      {
        name: "import",
        runs: 2,
        successRate: 50,
        medianDurationMs: 10,
        p95DurationMs: 20,
      },
    ]
    const snapshot = vi.fn(() => Effect.die("snapshot must not run"))
    const workflows = vi.fn(() => Effect.succeed(summaries))
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        queries.workflows({ _tag: "Key", header: "Bearer key" }),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(dependencies(repository({ snapshot, workflows }))),
          ),
        ),
      ),
    )
    expect(result).toEqual(summaries)
    expect(workflows).toHaveBeenCalledExactlyOnceWith("project-from-key")
    expect(snapshot).not.toHaveBeenCalled()
  })

  it("scopes a session reader to the requested member project", async () => {
    const snapshot = vi.fn(repository().snapshot)
    await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        queries.snapshot({
          _tag: "User",
          userId: "user-1",
          projectId: "requested-project",
        }),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ snapshot }),
                true,
                projectCredentials({
                  memberProject: () => Effect.succeed("requested-project"),
                }),
              ),
            ),
          ),
        ),
      ),
    )
    expect(snapshot).toHaveBeenCalledExactlyOnceWith("requested-project")
  })

  it("does not query another project after authorization fails", async () => {
    const timeline = vi.fn(repository().timeline)
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        Effect.result(
          queries.timeline({ _tag: "Key", header: "Bearer bad-key" }, "run-id"),
        ),
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

  it("searches only the authorized member project", async () => {
    const search = vi.fn(() =>
      Effect.succeed({
        workflows: [{ name: "customer.import" }],
        runs: [],
        references: [],
      }),
    )
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        queries.search(
          {
            _tag: "User",
            userId: "user-1",
            projectId: "requested-project",
          },
          "  customer  ",
        ),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ search }),
                true,
                projectCredentials({
                  memberProject: () => Effect.succeed("requested-project"),
                }),
              ),
            ),
          ),
        ),
      ),
    )
    expect(result.workflows).toEqual([{ name: "customer.import" }])
    expect(search).toHaveBeenCalledExactlyOnceWith(
      "requested-project",
      "customer",
    )
  })

  it("does not query when the search is blank", async () => {
    const search = vi.fn(repository().search)
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        queries.search({ _tag: "Key", header: "Bearer key" }, "   "),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(dependencies(repository({ search }))),
          ),
        ),
      ),
    )
    expect(result).toEqual({ workflows: [], runs: [], references: [] })
    expect(search).not.toHaveBeenCalled()
  })

  it("does not search after authorization fails", async () => {
    const search = vi.fn(repository().search)
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (queries) =>
        Effect.result(
          queries.search({ _tag: "Key", header: "Bearer bad-key" }, "customer"),
        ),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ search }),
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
    expect(search).not.toHaveBeenCalled()
  })

  it("discovers workflows for an authorized read key without declaration writes", async () => {
    const discoverWorkflows = vi.fn(repository().discoverWorkflows)
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        service.discoverWorkflows(
          { _tag: "Key", header: "Bearer key" },
          { limit: 25 },
        ),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(dependencies(repository({ discoverWorkflows }))),
          ),
        ),
      ),
    )
    const names = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        Effect.succeed(Object.keys(service)),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(dependencies(repository())),
          ),
        ),
      ),
    )
    expect(discoverWorkflows).toHaveBeenCalledWith("project-from-key", {
      limit: 25,
    })
    expect(result.applied.projectId).toBe("project-from-key")
    expect(result.capabilities.mutations).toEqual([])
    expect(names).toContain("discoverWorkflows")
    expect(names).toContain("discoverWorkflowMeaning")
    expect(names).not.toContain("setSearchFields")
    expect(names).not.toContain("create")
  })

  it("does not discover workflows in a project the user cannot read", async () => {
    const discoverWorkflows = vi.fn(() =>
      Effect.die("Must not read another project"),
    )
    const result = await Effect.runPromise(
      Effect.flatMap(GetProjectWorkflowData, (service) =>
        Effect.result(
          service.discoverWorkflows(
            { _tag: "User", userId: "user-1", projectId: "foreign-project" },
            {},
          ),
        ),
      ).pipe(
        Effect.provide(
          GetProjectWorkflowData.layer.pipe(
            Layer.provide(
              dependencies(
                repository({ discoverWorkflows }),
                true,
                projectCredentials({
                  memberProject: () => Effect.succeed(undefined),
                }),
              ),
            ),
          ),
        ),
      ),
    )
    expectLeft(result, { _tag: "Unauthorized", permission: "read" })
    expect(discoverWorkflows).not.toHaveBeenCalled()
  })

  it("maps discovery cursor failures to invalid input", async () => {
    const discoverWorkflows = vi.fn(() =>
      Effect.fail(
        new InvalidResultQuery({
          message: "Invalid workflow discovery cursor.",
        }),
      ),
    )
    const store = new Proxy({} as WorkflowStoreService, {
      get: (_target, property) =>
        property === "discoverWorkflows"
          ? discoverWorkflows
          : () => Effect.die(String(property)),
    })
    const result = await Effect.runPromise(
      Effect.flatMap(WorkflowRepository, (repository) =>
        Effect.result(
          repository.discoverWorkflows("project-a", { cursor: "foreign" }),
        ),
      ).pipe(
        Effect.provide(
          WorkflowRepositoryLive.pipe(
            Layer.provide(Layer.succeed(WorkflowStore, store as never)),
          ),
        ),
      ),
    )
    expectLeft(result, {
      _tag: "InvalidInput",
      cause: "Invalid workflow discovery cursor.",
    })
    expect(discoverWorkflows).toHaveBeenCalledWith("project-a", {
      cursor: "foreign",
    })
  })

  it("maps discovery database failures to persistence errors", async () => {
    const discoverWorkflowMeaning = vi.fn(() =>
      Effect.fail(
        new DatabaseError({
          operation: DatabaseOperation.ReadDeclarationDiscovery,
          cause: "down",
        }),
      ),
    )
    const store = new Proxy({} as WorkflowStoreService, {
      get: (_target, property) =>
        property === "discoverWorkflowMeaning"
          ? discoverWorkflowMeaning
          : () => Effect.die(String(property)),
    })
    const result = await Effect.runPromise(
      Effect.flatMap(WorkflowRepository, (repository) =>
        Effect.result(
          repository.discoverWorkflowMeaning("project-a", {
            workflow: "import",
          }),
        ),
      ).pipe(
        Effect.provide(
          WorkflowRepositoryLive.pipe(
            Layer.provide(Layer.succeed(WorkflowStore, store as never)),
          ),
        ),
      ),
    )
    expectLeft(result, {
      _tag: "PersistenceError",
      operation: DatabaseOperation.ReadDeclarationDiscovery,
    })
  })
})
