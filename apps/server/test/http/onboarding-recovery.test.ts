import { randomUUID } from "node:crypto"
import { Array, Effect } from "effect"
import {
  afterAll,
  beforeAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { createDatabase } from "@flowmark/db"
import { createFlowmark } from "../../../../packages/sdk/src/index.js"
import { POST as ingest } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc/router"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "selected-project onboarding recovery",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection.close()
    })
    afterEach(() => vi.unstubAllGlobals())
    const fixture = () =>
      Effect.runPromise(createDefinitionImportFixture(connection.db))
    const caller = (cookie: string, selected?: string) =>
      appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: {
            cookie,
            origin: "http://localhost:3001",
            ...(selected ? { "x-flowmark-project-id": selected } : {}),
          },
        }),
      })

    it("does not use another owned project's write key to finish or advance a read-only selection", async () => {
      const value = await fixture()
      const api = caller(value.cookie, value.projectId)
      const second = await api.project.create({
        name: "Read-only setup target",
      })
      await api.project.createReadKey({
        projectId: second.project.id,
        name: "Read only",
      })
      await api.project.createBrowserKey({
        projectId: second.project.id,
        name: "Browser only",
        origins: ["http://localhost:3000"],
      })
      await api.project.revokeApiKey({
        projectId: second.project.id,
        keyId: second.writeKey.id,
      })
      await api.onboarding.advance({
        step: "key",
        projectId: second.project.id,
      })
      await expect(
        api.onboarding.advance({
          step: "install",
          projectId: second.project.id,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        api.onboarding.complete({ projectId: second.project.id }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      expect((await api.onboarding.state()).completedAt).toBeNull()
      const recovered = await api.project.createWriteKey({
        projectId: second.project.id,
        name: "Setup recovery",
      })
      expect(recovered.secret).toMatch(/^fm_write_/)
      expect(
        Array.some(
          (await api.project.keys(second.project.id)).apiKeys,
          (key) => key.id === recovered.id && key.permission === "write",
        ),
      ).toBe(true)
      await api.onboarding.advance({
        step: "run",
        projectId: second.project.id,
      })
      expect(
        (await api.onboarding.snapshot(second.project.id)).metrics.totalRuns,
      ).toBe(0)
      await api.onboarding.complete({ projectId: second.project.id })
      expect((await api.onboarding.state()).completedAt).not.toBeNull()
    })

    it("reads actual SDK evidence from the explicit project rather than an ambient header", async () => {
      const value = await fixture()
      const api = caller(value.cookie, value.foreignProjectId)
      const empty = await api.project.create({ name: "No evidence yet" })
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
        ingest(new Request(input, init)),
      )
      const sdk = createFlowmark({
        apiKey: value.writeKey,
        apiUrl: "http://localhost",
      })
      const flow = sdk.workflow(`onboarding-${randomUUID()}`)
      flow.done({ outcome: "synthetic", result: { reported: 1 } })
      await sdk.shutdown()
      vi.unstubAllGlobals()
      expect(
        (await api.onboarding.snapshot(value.projectId)).metrics.totalRuns,
      ).toBe(1)
      expect(
        (await api.onboarding.snapshot(empty.project.id)).metrics.totalRuns,
      ).toBe(0)
      await expect(
        api.onboarding.snapshot(value.foreignProjectId),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await expect(
        api.onboarding.advance({
          step: "key",
          projectId: value.foreignProjectId,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })
  },
)
