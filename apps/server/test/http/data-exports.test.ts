import { createHash, randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { Array, Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  createDatabase,
  projectMembers,
  projects,
  session,
  workflowEvents,
  workflowRuns,
  workflows,
  user,
} from "@flowmark/db"
import { dataExportRequests } from "@flowmark/db/schema"
import { DataExportStore, Database, hashApiKey } from "@flowmark/db/persistence"
import { appRouter } from "../../src/adapters/trpc/router"
import { handleExportDownload } from "../../src/adapters/data-exports"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "account and owner project data exports",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection.close()
    })
    const fixture = () =>
      Effect.runPromise(createDefinitionImportFixture(connection.db))
    type Fixture = Awaited<ReturnType<typeof fixture>>
    const caller = (value: Fixture) =>
      appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: { cookie: value.cookie, origin: "http://localhost:3001" },
        }),
      })
    const download = (
      value: Fixture,
      id: string,
      cursor: string,
      origin = "http://localhost:3001",
    ) =>
      handleExportDownload(
        new Request("http://localhost:3001/v1/data-export", {
          method: "POST",
          headers: {
            cookie: value.cookie,
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ id, cursor }),
        }),
      )
    const records = (body: string) =>
      Array.map(body.trim().split("\n"), (line) => JSON.parse(line))

    it("exports only personal fields, excludes credentials and requires current password/session", async () => {
      const value = await fixture()
      await connection.db
        .update(user)
        .set({ name: "Åsa 日本語" })
        .where(eq(user.id, value.userId))
      await expect(
        caller(value).dataExports.create({
          projectId: null,
          password: "incorrect-password",
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const operation = await caller(value).dataExports.create({
        projectId: null,
        password: value.password,
      })
      const [browser] = await connection.db
        .select({ id: session.id })
        .from(session)
        .where(eq(session.userId, value.userId))
      const store = await Effect.runPromise(
        DataExportStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      // Also exercises lost-response retry: persistence can commit before HTTP arrives.
      await Effect.runPromise(
        store.part(value.userId, browser.id, operation.id, operation.cursor),
      )
      const response = await download(value, operation.id, operation.cursor)
      expect(response.status).toBe(200)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("content-disposition")).toMatch(
        /^attachment; filename="flowmark-account-/,
      )
      const body = await response.text()
      const digest = createHash("sha256").update(body).digest("base64")
      expect(response.headers.get("content-digest")).toBe(`sha-256=:${digest}:`)
      expect(body).toContain("Åsa 日本語")
      expect(body).not.toContain(value.readKey)
      expect(body).not.toContain(hashApiKey(value.readKey))
      expect(body).not.toContain(value.password)
      expect(body).not.toContain(value.cookie)
      const items = records(body)
      expect(items.at(-1)).toMatchObject({ type: "part-end", complete: true })
      expect(
        Array.filter(items, (item) => item.category === "user"),
      ).toHaveLength(1)
      expect(
        Array.some(items, (item) => item.category === "workflow_events"),
      ).toBe(false)
      const status = await caller(value).dataExports.latest({ projectId: null })
      expect(status).toMatchObject({
        id: operation.id,
        state: "complete",
        cursor: operation.cursor,
      })
      await connection.db
        .delete(session)
        .where(eq(session.userId, value.userId))
      expect(
        (await download(value, operation.id, operation.cursor)).status,
      ).not.toBe(200)
      expect(
        await connection.db
          .select()
          .from(dataExportRequests)
          .where(eq(dataExportRequests.id, operation.id)),
      ).toEqual([])
    })

    it("pages complete owner evidence, retries lost responses and keeps post-cutoff records out", async () => {
      const value = await fixture()
      const [workflow] = await connection.db
        .insert(workflows)
        .values({ projectId: value.projectId, name: `export-${randomUUID()}` })
        .returning()
      const [run] = await connection.db
        .insert(workflowRuns)
        .values({
          workflowId: workflow.id,
          externalId: "synthetic-å",
          startedAt: new Date(),
        })
        .returning()
      const [precise] = await connection.db
        .insert(workflowEvents)
        .values(
          Array.makeBy(125, () => ({
            eventId: randomUUID(),
            runId: run.id,
            type: "step" as const,
            step: "page",
            properties: { unicode: "å 日本語", applicationData: "synthetic" },
            occurredAt: new Date(),
          })),
        )
        .returning({ id: workflowEvents.id })
      await connection.db.execute(
        sql`UPDATE workflow_events SET progress_completed=9007199254740993 WHERE id=${precise.id}::uuid`,
      )
      const operation = await caller(value).dataExports.create({
        projectId: value.projectId,
        password: value.password,
      })
      const [late] = await connection.db
        .insert(workflowEvents)
        .values({
          eventId: randomUUID(),
          runId: run.id,
          type: "step",
          occurredAt: new Date(),
          createdAt: new Date(Date.now() + 10000),
        })
        .returning()
      const first = await download(value, operation.id, operation.cursor)
      expect(first.status).toBe(200)
      expect(first.headers.get("x-flowmark-export-complete")).toBe("false")
      const one = records(await first.text())
      const retry = records(
        await (await download(value, operation.id, operation.cursor)).text(),
      )
      expect(Array.filter(retry, (item) => item.type === undefined)).toEqual(
        Array.filter(one, (item) => item.type === undefined),
      )
      const cursor = first.headers.get("x-flowmark-export-next")!
      const second = await download(value, operation.id, cursor)
      expect(second.status).toBe(200)
      expect(second.headers.get("x-flowmark-export-complete")).toBe("true")
      const two = records(await second.text())
      const events = Array.filter(
        [...one, ...two],
        (item) => item.category === "workflow_events",
      )
      expect(events).toHaveLength(125)
      expect(
        Array.dedupe(Array.map(events, (item) => item.data.id)),
      ).toHaveLength(125)
      expect(Array.some(events, (item) => item.data.id === late.id)).toBe(false)
      expect(JSON.stringify(events)).toContain("日本語")
      expect(
        Array.some(
          events,
          (item) => item.data.progress_completed === "9007199254740993",
        ),
      ).toBe(true)
      expect(
        Array.some(
          [...one, ...two],
          (item) =>
            item.category === "project_api_keys" &&
            ("key_hash" in item.data || "key_prefix" in item.data),
        ),
      ).toBe(false)
    })

    it("bounds large payload parts and rolls back an oversized-record failure", async () => {
      const value = await fixture()
      const [workflow] = await connection.db
        .insert(workflows)
        .values({
          projectId: value.projectId,
          name: `large-export-${randomUUID()}`,
        })
        .returning()
      const [run] = await connection.db
        .insert(workflowRuns)
        .values({
          workflowId: workflow.id,
          externalId: "synthetic-large",
          startedAt: new Date(),
        })
        .returning()
      const seeded = await connection.db
        .insert(workflowEvents)
        .values(
          Array.makeBy(12, () => ({
            eventId: randomUUID(),
            runId: run.id,
            type: "step" as const,
            properties: { synthetic: "x".repeat(100000) },
            occurredAt: new Date(),
          })),
        )
        .returning({ id: workflowEvents.id })
      const operation = await caller(value).dataExports.create({
        projectId: value.projectId,
        password: value.password,
      })
      const first = await download(value, operation.id, operation.cursor)
      const firstBody = await first.text()
      expect(first.status).toBe(200)
      expect(Buffer.byteLength(firstBody)).toBeLessThan(1100000)
      expect(first.headers.get("x-flowmark-export-complete")).toBe("false")
      const second = await download(
        value,
        operation.id,
        first.headers.get("x-flowmark-export-next")!,
      )
      expect(second.status).toBe(200)
      const secondBody = await second.text()
      expect(second.headers.get("x-flowmark-export-complete")).toBe("true")
      expect(
        Array.filter(
          [...records(firstBody), ...records(secondBody)],
          (item) => item.category === "workflow_events",
        ),
      ).toHaveLength(12)
      await connection.db
        .update(workflowEvents)
        .set({ properties: { synthetic: "x".repeat(300000) } })
        .where(eq(workflowEvents.id, seeded[0].id))
      const oversized = await caller(value).dataExports.create({
        projectId: value.projectId,
        password: value.password,
      })
      const failed = await download(value, oversized.id, oversized.cursor)
      expect(failed.status).toBe(400)
      expect(failed.headers.has("content-disposition")).toBe(false)
      expect(
        await caller(value).dataExports.latest({ projectId: value.projectId }),
      ).toMatchObject({
        id: oversized.id,
        state: "ready",
        cursor: oversized.cursor,
        part: 1,
      })
    })

    it("denies foreign scopes, stale authority, cancelled/expired requests and untrusted origins", async () => {
      const value = await fixture()
      await expect(
        caller(value).dataExports.create({
          projectId: value.foreignProjectId,
          password: value.password,
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      const operation = await caller(value).dataExports.create({
        projectId: value.projectId,
        password: value.password,
      })
      expect(
        (
          await download(
            value,
            operation.id,
            operation.cursor,
            "https://evil.example",
          )
        ).status,
      ).toBe(403)
      const other = await fixture()
      expect(
        (await download(other, operation.id, operation.cursor)).status,
      ).not.toBe(200)
      await connection.db.insert(projectMembers).values({
        projectId: value.projectId,
        userId: other.userId,
        role: "viewer",
      })
      await expect(
        caller(other).dataExports.create({
          projectId: value.projectId,
          password: other.password,
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await caller(value).dataExports.cancel({ id: operation.id })
      expect(
        (await download(value, operation.id, operation.cursor)).status,
      ).not.toBe(200)
      const expired = await caller(value).dataExports.create({
        projectId: null,
        password: value.password,
      })
      await connection.db
        .update(dataExportRequests)
        .set({ expiresAt: new Date(0) })
        .where(eq(dataExportRequests.id, expired.id))
      expect(
        (await download(value, expired.id, expired.cursor)).status,
      ).not.toBe(200)
      const fenced = await caller(value).dataExports.create({
        projectId: value.projectId,
        password: value.password,
      })
      await connection.db
        .update(projects)
        .set({ lifecycleOperationId: randomUUID() })
        .where(eq(projects.id, value.projectId))
      expect((await download(value, fenced.id, fenced.cursor)).status).not.toBe(
        200,
      )
    })
  },
)
