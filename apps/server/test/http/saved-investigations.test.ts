import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { and, eq, sql } from "drizzle-orm"
import { Array, Effect } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projectMembers,
  savedInvestigations,
} from "@flowmark/db"
import { InvestigationStore, Database } from "@flowmark/db/persistence"
import { appRouter } from "../../src/adapters/trpc/router"
import { GET, POST } from "../../app/api/trpc/[trpc]/route"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

vi.setConfig({ testTimeout: 15000 })
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "private saved live investigations",
  () => {
    let connection: ReturnType<typeof createDatabase>
    let owner: Effect.Success<ReturnType<typeof createDefinitionImportFixture>>
    let other: typeof owner
    const caller = (
      cookie = owner.cookie,
      headers: Record<string, string> = {},
    ) =>
      appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: { cookie, ...headers },
        }),
      })
    const selection = (projectId = owner.projectId) => ({
      version: 1 as const,
      kind: "run" as const,
      projectId,
      runId: randomUUID(),
      section: "events" as const,
      limit: 7,
      cursor: "saved-page",
    })
    const save = (title = "Current question") =>
      caller().investigations.save({
        projectId: owner.projectId,
        command: { title, selection: selection() },
      })
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3001")
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", "http://localhost:3001")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      owner = await Effect.runPromise(
        createDefinitionImportFixture(connection.db),
      )
      other = await Effect.runPromise(
        createDefinitionImportFixture(connection.db),
      )
      await connection.db.insert(projectMembers).values({
        userId: other.userId,
        projectId: owner.projectId,
        role: "owner",
      })
    }, 30000)
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })
    it("saves only the exact live question and isolates another member, foreign project and deletion", async () => {
      const input = selection()
      const entry = await caller().investigations.save({
        projectId: owner.projectId,
        command: { title: "  Recheck booking  ", selection: input },
      })
      expect(entry).toMatchObject({
        title: "Recheck booking",
        supported: true,
        selection: input,
      })
      const read = await caller().investigations.get({
        projectId: owner.projectId,
        id: entry.id,
      })
      expect(read).toEqual(entry)
      expect(
        (
          await caller(other.cookie).investigations.list({
            projectId: owner.projectId,
            query: {},
          })
        ).items,
      ).toEqual([])
      expect(
        await caller(other.cookie).investigations.get({
          projectId: owner.projectId,
          id: entry.id,
        }),
      ).toBeNull()
      expect(
        await caller(other.cookie).investigations.delete({
          projectId: owner.projectId,
          id: entry.id,
        }),
      ).toEqual({ deleted: false })
      await expect(
        caller().investigations.get({
          projectId: owner.foreignProjectId,
          id: entry.id,
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      // The source was never reported: retaining a question does not create a run.
      const missing = await GET(
        new Request(
          `http://localhost:3001/api/trpc/run.detail?input=${encodeURIComponent(JSON.stringify({ id: input.runId }))}`,
          {
            headers: {
              cookie: owner.cookie,
              "x-flowmark-project-id": owner.projectId,
            },
          },
        ),
      )
      expect(missing.status).toBe(200)
      expect(await missing.json()).toMatchObject({ result: { data: [] } })
      expect(
        await caller().investigations.delete({
          projectId: owner.projectId,
          id: entry.id,
        }),
      ).toEqual({ deleted: true })
      expect(
        await caller().investigations.get({
          projectId: owner.projectId,
          id: entry.id,
        }),
      ).toBeNull()
      expect(
        await caller().investigations.delete({
          projectId: owner.projectId,
          id: entry.id,
        }),
      ).toEqual({ deleted: false })
    })
    it("rejects ingestion/read/delegated credentials and cookie-backed delegated management through real HTTP", async () => {
      const command = { title: "Denied", selection: selection() }
      const deniedHeaders: readonly Record<string, string>[] = [
        { authorization: `Bearer ${owner.readKey}` },
        { authorization: `Bearer ${owner.writeKey}` },
        { authorization: "Bearer synthetic-delegated-token" },
        {
          cookie: owner.cookie,
          "x-flowmark-grant-client-id": "read-only-client",
          "x-flowmark-grant-authorization-code-id": randomUUID(),
        },
      ]
      await Effect.runPromise(
        Effect.forEach(deniedHeaders, (headers: Record<string, string>) =>
          Effect.promise(async () => {
            const response = await POST(
              new Request(
                "http://localhost:3001/api/trpc/investigations.save",
                {
                  method: "POST",
                  headers: { ...headers, "content-type": "application/json" },
                  body: JSON.stringify({
                    projectId: owner.projectId,
                    command,
                  }),
                },
              ),
            )
            expect(response.status).toBe(401)
          }),
        ),
      )
    })
    it("rejects unsupported/new versions and extra credentials, but allows deletion of an unsupported stored selection", async () => {
      await Effect.runPromise(
        Effect.forEach(
          [
            { title: "Future", selection: { ...selection(), version: 2 } },
            { title: "Foreign", selection: selection(owner.foreignProjectId) },
            {
              title: "Credential",
              selection: { ...selection(), authorization: "private" },
            },
            { title: "Credential", selection: selection(), token: "private" },
            { title: " ", selection: selection() },
          ],
          (command) =>
            Effect.promise(async () => {
              await expect(
                caller().investigations.save({
                  projectId: owner.projectId,
                  command,
                }),
              ).rejects.toMatchObject({ code: "BAD_REQUEST" })
            }),
        ),
      )
      const [entry] = await connection.db
        .insert(savedInvestigations)
        .values({
          ownerId: owner.userId,
          projectId: owner.projectId,
          title: "Future stored view",
          selection: { version: 99, kind: "future", secret: "must-not-return" },
        })
        .returning({ id: savedInvestigations.id })
      expect(
        await caller().investigations.get({
          projectId: owner.projectId,
          id: entry!.id,
        }),
      ).toMatchObject({ supported: false, kind: null, selection: null })
      const page = await caller().investigations.list({
        projectId: owner.projectId,
        query: {},
      })
      expect(JSON.stringify(page)).not.toContain("must-not-return")
      expect(
        await caller().investigations.delete({
          projectId: owner.projectId,
          id: entry!.id,
        }),
      ).toEqual({ deleted: true })
    })
    it("reauthorizes list/read/delete/save after membership removal, including the persistence boundary", async () => {
      const entry = await save("Before revocation")
      const store = await Effect.runPromise(
        InvestigationStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await connection.db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.userId, owner.userId),
            eq(projectMembers.projectId, owner.projectId),
          ),
        )
      try {
        await expect(
          caller().investigations.list({
            projectId: owner.projectId,
            query: {},
          }),
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
        await expect(
          caller().investigations.get({
            projectId: owner.projectId,
            id: entry.id,
          }),
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
        await expect(
          caller().investigations.delete({
            projectId: owner.projectId,
            id: entry.id,
          }),
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
        await expect(save()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
        await expect(
          Effect.runPromise(
            store.delete(owner.userId, owner.projectId, entry.id),
          ),
        ).rejects.toMatchObject({
          _tag: "InvestigationRejected",
          reason: "Unauthorized",
        })
      } finally {
        await connection.db.insert(projectMembers).values({
          userId: owner.userId,
          projectId: owner.projectId,
          role: "owner",
        })
      }
      expect(
        (
          await caller().investigations.get({
            projectId: owner.projectId,
            id: entry.id,
          })
        )?.title,
      ).toBe("Before revocation")
      await caller().investigations.delete({
        projectId: owner.projectId,
        id: entry.id,
      })
    })
    it("pages stable microsecond populations, rejects foreign/stale cursors and atomically enforces the 100-entry owner cap", async () => {
      const projectId = other.projectId
      const rows = Array.map(Array.range(1, 99), (index) => ({
        id: randomUUID(),
        ownerId: other.userId,
        projectId,
        title: `Question ${index}`,
        selection: selection(projectId),
        createdAt: sql`TIMESTAMPTZ '2026-11-01T00:00:00.000001Z' + ${index} * INTERVAL '1 microsecond'`,
      }))
      await connection.db.insert(savedInvestigations).values(rows)
      const capped = await Promise.allSettled(
        Array.map(["A", "B"], (title) =>
          caller(other.cookie).investigations.save({
            projectId,
            command: { title, selection: selection(projectId) },
          }),
        ),
      )
      expect(
        Array.filter(capped, (result) => result.status === "fulfilled"),
      ).toHaveLength(1)
      expect(
        Array.filter(capped, (result) => result.status === "rejected"),
      ).toHaveLength(1)
      const first = await caller(other.cookie).investigations.list({
        projectId,
        query: { limit: 25 },
      })
      expect(first.items).toHaveLength(25)
      expect(first.items[24]!.title).toBe("Question 25")
      const second = await caller(other.cookie).investigations.list({
        projectId,
        query: { limit: 25, cursor: first.nextCursor! },
      })
      expect(second.items[0]!.title).toBe("Question 26")
      const third = await caller(other.cookie).investigations.list({
        projectId,
        query: { limit: 25, cursor: second.nextCursor! },
      })
      const last = await caller(other.cookie).investigations.list({
        projectId,
        query: { limit: 25, cursor: third.nextCursor! },
      })
      expect(last.items).toHaveLength(25)
      expect(last.nextCursor).toBeNull()
      expect(
        new Set(
          Array.map(
            [...first.items, ...second.items, ...third.items, ...last.items],
            (row) => row.id,
          ),
        ).size,
      ).toBe(100)
      await expect(
        caller().investigations.list({
          projectId: owner.projectId,
          query: { cursor: first.nextCursor },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await caller(other.cookie).investigations.delete({
        projectId,
        id: first.items[24]!.id,
      })
      await expect(
        caller(other.cookie).investigations.list({
          projectId,
          query: { cursor: first.nextCursor },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      expect(
        (
          await caller(other.cookie).investigations.save({
            projectId,
            command: {
              title: "Space recovered",
              selection: selection(projectId),
            },
          })
        ).supported,
      ).toBe(true)
    })
    it("applies the exact additive migration beside existing populated objects and cascades user deletion", async () => {
      const name = `saved_upgrade_${randomUUID().replaceAll("-", "")}`
      const migration = readFileSync(
        new URL(
          "../../../../packages/db/migrations/0023_private_live_investigations.sql",
          import.meta.url,
        ),
        "utf8",
      )
      const syntheticUser = randomUUID()
      await connection.db.transaction(async (tx) => {
        await tx.execute(sql`CREATE SCHEMA ${sql.identifier(name)}`)
        await tx.execute(
          sql`SET LOCAL search_path TO ${sql.identifier(name)}, public`,
        )
        // Namespace only the generated migration's FK targets, avoiding shared auth DDL locks.
        await tx.execute(sql`CREATE TABLE "user" (id text PRIMARY KEY)`)
        await tx.execute(sql`CREATE TABLE projects (id uuid PRIMARY KEY)`)
        await tx.execute(sql`INSERT INTO "user" VALUES (${syntheticUser})`)
        await tx.execute(
          sql`INSERT INTO projects VALUES (${owner.projectId}::uuid)`,
        )

        await tx.execute(sql`CREATE TABLE legacy_marker (value text NOT NULL)`)
        await tx.execute(sql`INSERT INTO legacy_marker VALUES ('preserved')`)
        await Effect.runPromise(
          Effect.forEach(
            migration.split("--> statement-breakpoint"),
            (statement) =>
              Effect.promise(() =>
                tx.execute(
                  sql.raw(statement.replaceAll('"public".', `"${name}".`)),
                ),
              ),
          ),
        )
        await tx.execute(
          sql`INSERT INTO saved_investigations (owner_id,project_id,title,selection) VALUES (${syntheticUser},${owner.projectId}::uuid,'Live question',${JSON.stringify(selection())}::jsonb)`,
        )
        expect(
          await tx.execute(sql`SELECT * FROM legacy_marker`),
        ).toMatchObject([{ value: "preserved" }])
        await tx.execute(sql`DELETE FROM "user" WHERE id = ${syntheticUser}`)
        expect(
          await tx.execute(sql`SELECT id FROM saved_investigations`),
        ).toHaveLength(0)
        await tx.execute(sql`DROP SCHEMA ${sql.identifier(name)} CASCADE`)
      })
    })
  },
)
