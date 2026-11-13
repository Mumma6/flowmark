import { randomUUID } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { Array, Effect, Ref } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projectMembers,
  sharedInvestigations,
  oauthClient,
  oauthRefreshToken,
  agentAccessGrantProjects,
} from "@flowmark/db"
import {
  Database,
  ProjectReadSubject,
  SharedInvestigationStore,
  WorkflowStore,
} from "@flowmark/db/persistence"
import { appRouter } from "../../src/adapters/trpc/router"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"
import { resetAuthCacheForTests } from "../../src/auth"
const origin = "http://localhost:3001",
  canary = "HIDDEN_SHARED_DIAGNOSTIC_CANARY",
  workflow = "sharing.orders"
const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)
vi.setConfig({ testTimeout: 30000 })
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "authenticated shared live investigations",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      vi.stubEnv("BETTER_AUTH_URL", origin)
      vi.stubEnv("FLOWMARK_DASHBOARD_ORIGIN", origin)
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
      resetAuthCacheForTests()
    })
    const caller = (
      cookie: string,
      projectId: string,
      extra: Record<string, string> = {},
    ) =>
      appRouter.createCaller({
        request: new Request(origin + "/api/trpc", {
          headers: {
            cookie,
            origin,
            "x-flowmark-project-id": projectId,
            ...extra,
          },
        }),
      })
    const fixture = async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      resetAuthCacheForTests()
      const owner = await run(createDefinitionImportFixture(connection.db)),
        viewer = await run(createDefinitionImportFixture(connection.db)),
        business = await run(createDefinitionImportFixture(connection.db)),
        stranger = await run(createDefinitionImportFixture(connection.db))
      const projectId = owner.projectId
      await connection.db.insert(projectMembers).values([
        { projectId, userId: viewer.userId, role: "viewer" },
        { projectId, userId: business.userId, role: "business" },
      ])
      const admin = caller(owner.cookie, projectId),
        reader = caller(viewer.cookie, projectId),
        limited = caller(business.cookie, projectId)
      const source = await run(
        WorkflowStore.make.pipe(Effect.provideService(Database, connection.db)),
      )
      const externalId = randomUUID(),
        timestamp = new Date().toISOString()
      await run(
        source.append(projectId, randomUUID(), {
          type: "started",
          workflow,
          runId: externalId,
          timestamp,
          properties: { private: canary },
        }),
      )
      await run(
        source.append(projectId, randomUUID(), {
          type: "completed",
          workflow,
          runId: externalId,
          timestamp,
          outcome: "accepted",
          result: { count: 3, private: canary },
        }),
      )
      const runId = (await run(source.listRuns(projectId, { workflow })))
        .runs[0]!.id
      const selection = {
        version: 1 as const,
        depth: "diagnostic" as const,
        query: {
          version: 1 as const,
          kind: "run" as const,
          projectId,
          runId,
          section: "events" as const,
        },
      }
      const question = { title: canary, selection }
      const publicQuestion = {
        title: "Published activity",
        selection: {
          version: 1 as const,
          depth: "business" as const,
          query: { kind: "run" as const, runId },
        },
      }
      return {
        owner,
        viewer,
        business,
        stranger,
        projectId,
        admin,
        reader,
        limited,
        selection,
        question,
        publicQuestion,
      }
    }
    it("shares an immutable copy without exposing private originals or diagnostic metadata to business members", async () => {
      const f = await fixture()
      const original = await f.admin.investigations.save({
        projectId: f.projectId,
        command: { title: canary, selection: f.selection.query },
      })
      const shared = await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.question,
      })
      expect(
        await f.reader.investigations.get({
          projectId: f.projectId,
          id: original.id,
        }),
      ).toBeNull()
      expect(
        await f.reader.sharedInvestigations.get({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).toMatchObject({
        selection: f.selection,
        canRevoke: false,
        available: true,
      })
      expect(
        (
          await f.limited.sharedInvestigations.list({
            projectId: f.projectId,
            query: {},
          })
        ).items,
      ).toEqual([])
      expect(
        JSON.stringify(
          await f.reader.run.detail({ id: f.selection.query.runId }),
        ),
      ).toContain(canary)
      const publicCopy = await f.limited.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      const publicRead = await f.reader.sharedInvestigations.get({
        projectId: f.projectId,
        id: publicCopy.id,
      })
      expect(publicRead.selection.depth).toBe("business")
      if (publicRead.selection.depth === "business") {
        expect(
          JSON.stringify(
            await f.reader.businessEvidence.read(publicRead.selection.query),
          ),
        ).not.toContain(canary)
      }
      await expect(
        caller(
          f.business.cookie,
          f.business.projectId,
        ).sharedInvestigations.get({
          projectId: f.business.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow("unavailable")
      await f.limited.sharedInvestigations.revoke({
        projectId: f.projectId,
        id: publicCopy.id,
      })
      await expect(
        f.limited.sharedInvestigations.get({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        f.reader.sharedInvestigations.revoke({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow()
      await expect(
        caller(f.stranger.cookie, f.projectId).sharedInvestigations.get({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow()
      await expect(
        f.admin.sharedInvestigations.get({
          projectId: f.projectId,
          id: randomUUID(),
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        caller(
          f.owner.cookie,
          f.owner.foreignProjectId,
        ).sharedInvestigations.get({
          projectId: f.owner.foreignProjectId,
          id: shared.id,
        }),
      ).rejects.toThrow()
      await expect(
        connection.db
          .update(sharedInvestigations)
          .set({ title: "mutated" })
          .where(eq(sharedInvestigations.id, shared.id)),
      ).rejects.toThrow()
      await f.admin.investigations.delete({
        projectId: f.projectId,
        id: original.id,
      })
      expect(
        await f.reader.sharedInvestigations.get({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).toMatchObject({ selection: f.selection })
      await f.admin.sharedInvestigations.revoke({
        projectId: f.projectId,
        id: shared.id,
      })
      await expect(
        f.reader.sharedInvestigations.get({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow("unavailable")
      const owned = await f.reader.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      await f.admin.sharedInvestigations.revoke({
        projectId: f.projectId,
        id: owned.id,
      })
      expect(
        (
          await f.reader.sharedInvestigations.list({
            projectId: f.projectId,
            query: {},
          })
        ).items,
      ).toEqual([])
    })
    it("validates publication before disclosing titles or filters and keeps invalid copies revocable", async () => {
      const f = await fixture()
      await f.admin.resultDeclarations.setSearchFields({
        projectId: f.projectId,
        workflow,
        fields: [
          { key: "customer", role: "lookup" },
          { key: "private", role: "lookup" },
        ],
      })
      const publication = {
        results: [],
        references: [{ workflow, keys: ["customer"] }],
      }
      const command = {
        title: "Customer question",
        selection: {
          version: 1 as const,
          depth: "business" as const,
          query: {
            kind: "journey" as const,
            query: {
              workflow,
              key: "customer",
              value: "synthetic-customer",
              namespaces: [{ workflow, key: "customer" }],
            },
          },
        },
      }
      await expect(
        f.limited.sharedInvestigations.create({
          projectId: f.projectId,
          command,
        }),
      ).rejects.toThrow("withheld")
      await f.admin.businessEvidence.replace({
        projectId: f.projectId,
        expectedRevision: 0,
        publication,
      })
      const shared = await f.limited.sharedInvestigations.create({
        projectId: f.projectId,
        command,
      })
      expect(
        await f.reader.sharedInvestigations.get({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).toMatchObject({ selection: command.selection })
      await expect(
        f.limited.sharedInvestigations.create({
          projectId: f.projectId,
          command: f.question,
        }),
      ).rejects.toThrow()
      await expect(
        f.admin.sharedInvestigations.create({
          projectId: f.projectId,
          command: {
            ...command,
            selection: {
              ...command.selection,
              query: { kind: "runs", query: { release: canary } },
            },
          },
        } as never),
      ).rejects.toThrow()
      await f.admin.businessEvidence.replace({
        projectId: f.projectId,
        expectedRevision: 1,
        publication: { results: [], references: [] },
      })
      await expect(
        f.reader.sharedInvestigations.get({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow("unavailable")
      expect(
        (
          await f.reader.sharedInvestigations.list({
            projectId: f.projectId,
            query: {},
          })
        ).items,
      ).toEqual([])
      const cleanup = await f.limited.sharedInvestigations.list({
        projectId: f.projectId,
        query: {},
      })
      expect(cleanup.items).toEqual([
        expect.objectContaining({
          id: shared.id,
          title: null,
          depth: null,
          available: false,
          canRevoke: true,
        }),
      ])
      expect(JSON.stringify(cleanup)).not.toContain(command.title)
      expect(JSON.stringify(cleanup)).not.toContain("synthetic-customer")
      await f.limited.sharedInvestigations.revoke({
        projectId: f.projectId,
        id: shared.id,
      })
      expect(
        (
          await f.limited.sharedInvestigations.list({
            projectId: f.projectId,
            query: {},
          })
        ).items,
      ).toEqual([])
    })
    it("rejects cursors, forged scope, mixed credentials and untrusted management origins", async () => {
      const f = await fixture()
      await expect(
        f.admin.sharedInvestigations.create({
          projectId: f.projectId,
          command: {
            ...f.question,
            selection: {
              ...f.selection,
              query: { ...f.selection.query, cursor: "continuation" },
            },
          },
        }),
      ).rejects.toThrow("first-page")
      await expect(
        f.admin.sharedInvestigations.create({
          projectId: f.projectId,
          command: {
            ...f.question,
            selection: {
              ...f.selection,
              query: {
                ...f.selection.query,
                projectId: f.owner.foreignProjectId,
              },
            },
          },
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        caller(f.owner.cookie, f.projectId, {
          origin: "http://untrusted.example.test",
        }).sharedInvestigations.create({
          projectId: f.projectId,
          command: f.publicQuestion,
        }),
      ).rejects.toThrow("trusted Studio")
      await expect(
        caller(f.owner.cookie, f.projectId, {
          authorization: `Bearer ${f.owner.readKey}`,
        }).sharedInvestigations.create({
          projectId: f.projectId,
          command: f.publicQuestion,
        }),
      ).rejects.toThrow()
      const shared = await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      await expect(
        caller("", f.projectId, {
          authorization: `Bearer ${f.owner.readKey}`,
        }).sharedInvestigations.get({ projectId: f.projectId, id: shared.id }),
      ).rejects.toThrow()
      const store = await run(
        SharedInvestigationStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await expect(
        run(store.withAccess(f.projectId, false, (a) => a.records())),
      ).rejects.toThrow()
      await expect(
        run(
          store
            .withAccess(f.projectId, false, (a) => a.create(f.publicQuestion))
            .pipe(
              Effect.provideService(ProjectReadSubject, {
                kind: "user",
                userId: f.owner.userId,
              }),
            ),
        ),
      ).rejects.toThrow()
    })
    it("pages only visible questions and rejects foreign, reader-bound and stale-publication cursors", async () => {
      const f = await fixture()
      await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: { ...f.publicQuestion, title: "Second public question" },
      })
      await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.question,
      })
      const first = await f.limited.sharedInvestigations.list({
        projectId: f.projectId,
        query: { limit: 1 },
      })
      expect(first.items).toHaveLength(1)
      expect(first.nextCursor).not.toBeNull()
      const next = await f.limited.sharedInvestigations.list({
        projectId: f.projectId,
        query: { limit: 1, cursor: first.nextCursor! },
      })
      expect(next.items).toHaveLength(1)
      expect(next.items[0]?.id).not.toBe(first.items[0]?.id)
      expect(next.nextCursor).toBeNull()
      expect(JSON.stringify([first, next])).not.toContain(canary)
      await expect(
        f.reader.sharedInvestigations.list({
          projectId: f.projectId,
          query: { limit: 1, cursor: first.nextCursor! },
        }),
      ).rejects.toThrow("changed")
      await expect(
        caller(
          f.business.cookie,
          f.business.projectId,
        ).sharedInvestigations.list({
          projectId: f.business.projectId,
          query: { limit: 1, cursor: first.nextCursor! },
        }),
      ).rejects.toThrow("changed")
      await f.admin.businessEvidence.replace({
        projectId: f.projectId,
        expectedRevision: 0,
        publication: { results: [], references: [] },
      })
      await expect(
        f.limited.sharedInvestigations.list({
          projectId: f.projectId,
          query: { limit: 1, cursor: first.nextCursor! },
        }),
      ).rejects.toThrow("changed")
    })
    it("atomically enforces creator/project quotas and rolls back rejected creates", async () => {
      const f = await fixture()
      await connection.db.insert(sharedInvestigations).values(
        Array.makeBy(24, (i) => ({
          projectId: f.projectId,
          creatorId: f.owner.userId,
          title: `Question ${i}`,
          selection: f.publicQuestion.selection,
        })),
      )
      const last = await Promise.allSettled(
        Array.makeBy(2, () =>
          f.admin.sharedInvestigations.create({
            projectId: f.projectId,
            command: f.publicQuestion,
          }),
        ),
      )
      expect(
        last.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1)
      expect(
        await connection.db
          .select()
          .from(sharedInvestigations)
          .where(eq(sharedInvestigations.projectId, f.projectId)),
      ).toHaveLength(25)
      await connection.db.insert(projectMembers).values({
        projectId: f.projectId,
        userId: f.stranger.userId,
        role: "viewer",
      })
      await connection.db.insert(sharedInvestigations).values(
        Array.flatMap([f.viewer, f.business, f.stranger], (actor) =>
          Array.makeBy(25, (i) => ({
            projectId: f.projectId,
            creatorId: actor.userId,
            title: `Question ${i}`,
            selection: f.publicQuestion.selection,
          })),
        ),
      )
      const extra = await run(createDefinitionImportFixture(connection.db))
      await connection.db.insert(projectMembers).values({
        projectId: f.projectId,
        userId: extra.userId,
        role: "viewer",
      })
      await expect(
        caller(extra.cookie, f.projectId).sharedInvestigations.create({
          projectId: f.projectId,
          command: f.publicQuestion,
        }),
      ).rejects.toThrow("limit")
      expect(
        await connection.db
          .select()
          .from(sharedInvestigations)
          .where(eq(sharedInvestigations.projectId, f.projectId)),
      ).toHaveLength(100)
    })
    it("removes creator copies permanently on leave and denies delayed or revoked delegated reads", async () => {
      const f = await fixture()
      const own = await f.limited.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      const preserved = await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      const clientId = randomUUID(),
        family = randomUUID()
      await connection.db.insert(oauthClient).values({
        id: randomUUID(),
        clientId,
        redirectUris: [origin + "/callback"],
      })
      await connection.db.insert(oauthRefreshToken).values({
        id: randomUUID(),
        token: randomUUID(),
        userId: f.business.userId,
        clientId,
        authorizationCodeId: family,
        scopes: ["flowmark:read"],
      })
      await connection.db
        .insert(agentAccessGrantProjects)
        .values({ projectId: f.projectId, authorizationCodeId: family })
      const delegated = caller(f.business.cookie, f.projectId, {
        "x-flowmark-grant-client-id": clientId,
        "x-flowmark-grant-authorization-code-id": family,
      })
      expect(
        await delegated.sharedInvestigations.get({
          projectId: f.projectId,
          id: own.id,
        }),
      ).toMatchObject({ id: own.id, canRevoke: false })
      await expect(
        delegated.sharedInvestigations.revoke({
          projectId: f.projectId,
          id: own.id,
        }),
      ).rejects.toThrow()
      const store = await run(
        SharedInvestigationStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      const delayed = store
        .withAccess(f.projectId, false, (a) => a.records())
        .pipe(
          Effect.provideService(ProjectReadSubject, {
            kind: "user",
            userId: f.business.userId,
          }),
        )
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      await expect(run(delayed)).rejects.toThrow()
      await expect(
        f.reader.sharedInvestigations.get({
          projectId: f.projectId,
          id: own.id,
        }),
      ).rejects.toThrow("unavailable")
      await connection.db.insert(projectMembers).values({
        projectId: f.projectId,
        userId: f.business.userId,
        role: "business",
      })
      await expect(
        f.limited.sharedInvestigations.get({
          projectId: f.projectId,
          id: own.id,
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        delegated.sharedInvestigations.get({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).rejects.toThrow()
      expect(
        await f.limited.sharedInvestigations.get({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).toMatchObject({ id: preserved.id })
      expect(
        await connection.db
          .select()
          .from(sharedInvestigations)
          .where(
            and(
              eq(sharedInvestigations.projectId, f.projectId),
              eq(sharedInvestigations.creatorId, f.business.userId),
            ),
          ),
      ).toHaveLength(0)
    })
    it("drains creator copies during account erasure without changing another member's questions", async () => {
      const f = await fixture()
      await f.limited.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      const preserved = await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      const preview = await f.limited.accountLifecycle.preview()
      const confirmed = await f.limited.accountLifecycle.confirm({
        operationId: preview.operation.id,
        confirmation: "DELETE MY ACCOUNT",
        password: f.business.password,
      })
      const progress = await run(Ref.make(confirmed))
      await run(
        Effect.forEach(Array.range(1, 80), () =>
          Effect.gen(function* () {
            if ((yield* Ref.get(progress)).state !== "live_data_deleted") {
              const next = yield* Effect.promise(() =>
                caller("", f.projectId).accountLifecycle.resume({
                  operationId: preview.operation.id,
                  capability: preview.capability,
                }),
              )
              yield* Ref.set(progress, next)
            }
          }),
        ),
      )
      expect((await run(Ref.get(progress))).state).toBe("live_data_deleted")
      expect(
        await connection.db
          .select()
          .from(sharedInvestigations)
          .where(eq(sharedInvestigations.creatorId, f.business.userId)),
      ).toHaveLength(0)
      expect(
        await f.reader.sharedInvestigations.get({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).toMatchObject({ id: preserved.id })
    })
    it("drains shared questions during project deletion through the existing bounded phase", async () => {
      const f = await fixture()
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.viewer.userId,
      })
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      await f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: f.publicQuestion,
      })
      await f.admin.investigations.save({
        projectId: f.projectId,
        command: { title: "Private original", selection: f.selection.query },
      })
      const preview = await f.admin.dataLifecycle.preview({
        projectId: f.projectId,
        scope: { kind: "project" },
      })
      const confirmed = await f.admin.dataLifecycle.confirm({
        projectId: f.projectId,
        operationId: preview.id,
        confirmation: "Booking setup",
        password: f.owner.password,
      })
      const progress = await run(Ref.make(confirmed))
      await run(
        Effect.forEach(Array.range(1, 80), () =>
          Effect.gen(function* () {
            if ((yield* Ref.get(progress)).state !== "live_data_deleted") {
              yield* Ref.set(
                progress,
                yield* Effect.promise(() =>
                  f.admin.dataLifecycle.resume({
                    projectId: f.projectId,
                    operationId: preview.id,
                  }),
                ),
              )
            }
          }),
        ),
      )
      expect((await run(Ref.get(progress))).state).toBe("live_data_deleted")
      expect(
        await connection.db
          .select()
          .from(sharedInvestigations)
          .where(eq(sharedInvestigations.projectId, f.projectId)),
      ).toEqual([])
    })
  },
)
