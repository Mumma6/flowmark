import { Effect, Layer, Redacted, Result } from "effect"
import { expect, it, vi } from "vitest"
import { DEMO_READ_KEY } from "@flowmark/db/demo"
import { ApiSettings } from "../../src/config.js"
import { ReadPublicRun } from "../../src/features/public-reads/use-cases/read-run.js"
import { PublicReadAdmission } from "../../src/features/public-reads/ports/public-read-admission.js"
import { PublicReadFailure } from "../../src/features/public-reads/errors.js"
import { AuthorizeProject } from "../../src/features/project-access/use-cases/authorize-project.js"
import { ProjectCredentials } from "../../src/features/project-access/ports/project-credentials.js"
import { WorkflowRepository } from "../../src/features/workflows/ports/workflow-repository.js"

const input = {
  version: 1,
  kind: "run",
  section: "events",
  projectId: "00000000-0000-4000-8000-000000000001",
  runId: "00000000-0000-4000-8000-000000000002",
} as const

const failure = <A, E>(result: Result.Result<A, E>) =>
  Result.match(result, {
    onFailure: (error) => error,
    onSuccess: () => expect.fail("Expected failure"),
  })

function fixture(denied = false) {
  const authenticate = vi.fn(
    (key: Redacted.Redacted<string>, permission: string) =>
      Effect.succeed(
        permission === "read" && Redacted.value(key) === "fm_read_valid"
          ? input.projectId
          : undefined,
      ),
  )
  const runRead = vi.fn(() =>
    Effect.succeed({
      summary: {
        id: input.runId,
        workflow: "test",
        status: "Running" as const,
        startedAt: "2026-11-10T00:00:00.000Z",
        durationMs: null,
        eventCount: 0,
      },
      page: { events: [], limit: 50, totalEvents: 0, nextCursor: null },
    }),
  )
  const consume = vi.fn(() =>
    denied
      ? Effect.fail(
          new PublicReadFailure({
            code: "RATE_LIMITED",
            retryAfterSeconds: 42,
          }),
        )
      : Effect.void,
  )
  const auth = AuthorizeProject.layer.pipe(
    Layer.provide(Layer.mock(ProjectCredentials, { authenticate })),
    Layer.provide(
      Layer.succeed(ApiSettings, {
        databaseUrl: Redacted.make("unused"),
        demoMode: true,
        mcpResourceUrl: undefined,
      }),
    ),
  )
  const layer = ReadPublicRun.layer.pipe(
    Layer.provide(auth),
    Layer.provide(Layer.mock(WorkflowRepository, { runRead })),
    Layer.provide(Layer.succeed(PublicReadAdmission, { consume })),
  )
  const read = (
    body: unknown = input,
    header: string | null = "Bearer fm_read_valid",
  ) =>
    Effect.runPromise(
      Effect.result(
        Effect.flatMap(ReadPublicRun, (service) => service.read(header, body)),
      ).pipe(Effect.provide(layer)),
    )
  return { read, authenticate, runRead, consume }
}

it("returns empty retained evidence with exact shared selection and no alternate authority", async () => {
  const f = fixture()
  const result = Result.getOrThrow(await f.read())
  expect(result.selection).toEqual({ ...input, limit: 50 })
  expect(result.page.events).toEqual([])
  expect(result.evidence.runPath).toContain("selection=")
  expect(f.authenticate).toHaveBeenCalledWith(expect.anything(), "read")
})

it.each([
  null,
  "Bearer fm_write_valid",
  "Bearer fm_browser_valid",
  `Bearer ${DEMO_READ_KEY}`,
  "Bearer oauth-token",
  "Bearer fm_read_revoked",
])("denies credential %s before evidence reads", async (header) => {
  const f = fixture()
  expect(failure(await f.read(input, header))).toMatchObject({
    code: "UNAUTHORIZED",
  })
  expect(f.runRead).not.toHaveBeenCalled()
})

it.each([
  [
    { ...input, projectId: "00000000-0000-4000-8000-000000000009" },
    "PROJECT_FORBIDDEN",
  ],
  [{ ...input, version: 2 }, "UNSUPPORTED_VERSION"],
  [{ ...input, section: "related" }, "UNSUPPORTED_SELECTION"],
  [{ ...input, revision: "v2" }, "UNSUPPORTED_SELECTION"],
  [{ ...input, cursor: "" }, "INVALID_REQUEST"],
  [{ ...input, limit: 101 }, "INVALID_REQUEST"],
])(
  "rejects invalid or foreign selection before evidence",
  async (body, code) => {
    const f = fixture()
    expect(failure(await f.read(body))).toMatchObject({ code })
    expect(f.runRead).not.toHaveBeenCalled()
  },
)

it("denies admission before authenticating or reading and preserves retry delay", async () => {
  const f = fixture(true)
  expect(failure(await f.read())).toMatchObject({
    code: "RATE_LIMITED",
    retryAfterSeconds: 42,
  })
  expect(f.authenticate).not.toHaveBeenCalled()
  expect(f.runRead).not.toHaveBeenCalled()
})
