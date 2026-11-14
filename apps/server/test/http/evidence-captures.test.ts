import { CapturedRunEvidenceSchema } from "@flowmark/api"
import {
  evidenceCaptures,
  oauthClient,
  oauthRefreshToken,
  agentAccessGrantProjects,
} from "@flowmark/db"
import { EvidenceCaptureStore } from "@flowmark/db/persistence"
import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { Effect, Array, Ref, Schema } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase, projectMembers } from "@flowmark/db"
import {
  Database,
  WorkflowStore,
  ProjectReadSubject,
} from "@flowmark/db/persistence"
import { appRouter } from "../../src/adapters/trpc/router"
import { resetAuthCacheForTests } from "../../src/auth"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"
const origin = "http://localhost:3001",
  workflow = "business.orders",
  canary = "PRIVATE_DIAGNOSTIC_CANARY"
const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)
vi.setConfig({ testTimeout: 30000 })
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "bounded captured business evidence",
  () => {
    let connection: ReturnType<typeof createDatabase>
    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection?.close()
      vi.restoreAllMocks()
      vi.unstubAllEnvs()
      resetAuthCacheForTests()
    })
    const caller = (
      cookie: string,
      projectId?: string,
      extra: Record<string, string> = {},
    ) =>
      appRouter.createCaller({
        request: new Request(origin + "/api/trpc", {
          headers: {
            cookie,
            origin,
            ...(projectId ? { "x-flowmark-project-id": projectId } : {}),
            ...extra,
          },
        }),
      })
    const fixture = async () => {
      vi.stubEnv("BETTER_AUTH_SECRET", `${randomUUID()}${randomUUID()}`)
      resetAuthCacheForTests()
      const owner = await run(createDefinitionImportFixture(connection.db)),
        business = await run(createDefinitionImportFixture(connection.db)),
        diagnostic = await run(createDefinitionImportFixture(connection.db)),
        stranger = await run(createDefinitionImportFixture(connection.db))
      const projectId = owner.projectId
      await connection.db.insert(projectMembers).values([
        { userId: business.userId, projectId, role: "business" },
        { userId: diagnostic.userId, projectId, role: "viewer" },
      ])
      const admin = caller(owner.cookie, projectId),
        reader = caller(business.cookie, projectId),
        viewer = caller(diagnostic.cookie, projectId),
        outsider = caller(stranger.cookie, projectId)
      await admin.resultDeclarations.create({
        projectId,
        workflow,
        declaration: {
          revision: "v1",
          fields: [
            {
              path: ["accepted"],
              label: "Accepted bookings",
              kind: "count",
              aggregate: true,
            },
            {
              path: ["private"],
              label: canary,
              kind: "count",
              aggregate: true,
            },
          ],
        },
      })
      await admin.resultDeclarations.setSearchFields({
        projectId,
        workflow,
        fields: [
          { key: "customer", role: "lookup" },
          { key: "private", role: "lookup" },
        ],
      })
      const store = await run(
        WorkflowStore.make.pipe(Effect.provideService(Database, connection.db)),
      )
      const externalId = randomUUID(),
        now = new Date(Date.now() - 1000).toISOString()
      await run(
        store.append(projectId, randomUUID(), {
          type: "started",
          workflow,
          runId: externalId,
          timestamp: now,
          environment: canary,
          release: canary,
          properties: {
            definitionRevision: "v1",
            customer: "customer-1",
            private: canary,
          },
        }),
      )
      await run(
        store.append(projectId, randomUUID(), {
          type: "error",
          workflow,
          runId: externalId,
          timestamp: now,
          error: { code: canary, message: canary, handled: true },
        }),
      )
      await run(
        store.append(projectId, randomUUID(), {
          type: "completed",
          workflow,
          runId: externalId,
          timestamp: new Date().toISOString(),
          outcome: "accepted",
          result: { accepted: 3, private: 999 },
        }),
      )
      const id = (await run(store.listRuns(projectId, { workflow }))).runs[0]!
        .id
      await connection.db.execute(
        sql`UPDATE workflow_runs SET external_id=${canary} WHERE id=${id}::uuid`,
      )
      const publication = {
        results: [{ workflow, revision: "v1", paths: [["accepted"]] }],
        references: [{ workflow, keys: ["customer"] }],
      }
      const publish = (expectedRevision = 0) =>
        admin.businessEvidence.replace({
          projectId,
          expectedRevision,
          publication,
        })
      return {
        owner,
        business,
        diagnostic,
        stranger,
        projectId,
        admin,
        reader,
        viewer,
        outsider,
        id,
        store,
        publish,
        publication,
      }
    }
    const capture = async (
      f: Awaited<ReturnType<typeof fixture>>,
      title = "Business observation",
    ) =>
      f.admin.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: f.id, title },
      })
    it("stores only server-projected evidence even for owners and reopens with capture provenance", async () => {
      const f = await fixture()
      await f.publish()
      await connection.db.execute(
        sql`UPDATE workflow_run_facts SET result=jsonb_build_object('accepted',3,'private',${canary.repeat(5000)}::text) WHERE run_id=${f.id}::uuid`,
      )
      const saved = await f.admin.evidenceCaptures.create({
        projectId: f.projectId.toUpperCase(),
        command: { runId: f.id, title: "Business observation" },
      })
      const read = await f.reader.evidenceCaptures.get({
        projectId: f.projectId,
        id: saved.id.toUpperCase(),
      })
      expect(read.available).toBe(true)
      if (!read.available) {
        throw new Error("Expected readable capture")
      }
      expect(read.capture.evidence.data.fields).toMatchObject([
        { path: ["accepted"], state: "available", value: 3 },
      ])
      expect(read.capture.evidence.data.references).toEqual([
        { key: "customer", value: "customer-1" },
      ])
      expect(read.capture.evidence.projection).toMatchObject({
        publicationRevision: 1,
        depth: "business",
        observedAt: read.capture.capturedAt,
      })
      expect(
        Date.parse(read.capture.expiresAt) -
          Date.parse(read.capture.capturedAt),
      ).toBeLessThanOrEqual(86400000)
      expect(
        new TextEncoder().encode(JSON.stringify(read.capture)).byteLength,
      ).toBeLessThanOrEqual(65536)
      expect(JSON.stringify(read)).not.toContain(canary)
      expect(read.canDelete).toBe(false)
      const [stored] = await connection.db
        .select()
        .from(evidenceCaptures)
        .where(eq(evidenceCaptures.id, saved.id))
      expect(stored?.payload).toEqual(read.capture)
      await connection.db.execute(
        sql`UPDATE workflow_run_facts SET result='{"accepted":9}'::jsonb WHERE run_id=${f.id}::uuid`,
      )
      expect(
        await f.viewer.evidenceCaptures.get({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).toMatchObject({
        capture: { evidence: { data: { fields: [{ value: 3 }] } } },
      })
      await expect(
        connection.db
          .update(evidenceCaptures)
          .set({ payload: {} })
          .where(eq(evidenceCaptures.id, saved.id)),
      ).rejects.toThrow()
      await expect(
        f.reader.evidenceCaptures.delete({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).rejects.toThrow()
      await f.admin.evidenceCaptures.delete({
        projectId: f.projectId,
        id: saved.id,
      })
      await expect(
        f.admin.evidenceCaptures.get({ projectId: f.projectId, id: saved.id }),
      ).rejects.toThrow("unavailable")
    })
    it("rejects projection bypass, oversized selected leaves, keys, foreign IDs and hostile origins", async () => {
      const f = await fixture()
      await f.publish()
      await expect(
        f.admin.evidenceCaptures.create({
          projectId: f.projectId,
          command: {
            runId: f.id,
            title: "forged",
            payload: { secret: canary },
          },
        } as never),
      ).rejects.toThrow()
      await connection.db.execute(
        sql`UPDATE workflow_run_facts SET result=jsonb_build_object('accepted',${"x".repeat(70000)}::text) WHERE run_id=${f.id}::uuid`,
      )
      await expect(capture(f)).rejects.toThrow("64 KiB")
      expect(
        await connection.db
          .select()
          .from(evidenceCaptures)
          .where(eq(evidenceCaptures.projectId, f.projectId)),
      ).toHaveLength(0)
      await expect(
        f.outsider.evidenceCaptures.create({
          projectId: f.projectId,
          command: { runId: f.id, title: "foreign" },
        }),
      ).rejects.toThrow()
      await expect(
        f.admin.evidenceCaptures.create({
          projectId: f.projectId,
          command: { runId: randomUUID(), title: "missing" },
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        caller(f.owner.cookie, f.projectId, {
          origin: "https://evil.invalid",
        }).evidenceCaptures.create({
          projectId: f.projectId,
          command: { runId: f.id, title: "evil" },
        }),
      ).rejects.toThrow()
      const key = caller("", f.projectId, {
        authorization: `Bearer ${f.owner.readKey}`,
      })
      await expect(
        key.evidenceCaptures.list({ projectId: f.projectId, query: {} }),
      ).rejects.toThrow()
      await expect(
        key.evidenceCaptures.capabilities({ projectId: f.projectId }),
      ).rejects.toThrow()
      await expect(
        key.evidenceCaptures.create({
          projectId: f.projectId,
          command: { runId: f.id, title: "key" },
        }),
      ).rejects.toThrow()
    })
    it("hides invalidated titles, expires against source lifetime, and never revives after republishing", async () => {
      const f = await fixture()
      await f.publish()
      const saved = await capture(f, canary)
      await f.admin.businessEvidence.replace({
        projectId: f.projectId,
        expectedRevision: 1,
        publication: { results: [], references: [] },
      })
      expect(
        await f.admin.evidenceCaptures.get({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).toEqual({
        available: false,
        id: saved.id,
        capturedAt: expect.any(String),
        reason: "PublicationChanged",
      })
      expect(
        (
          await f.reader.evidenceCaptures.list({
            projectId: f.projectId,
            query: {},
          })
        ).items,
      ).toEqual([])
      await expect(
        f.reader.evidenceCaptures.get({ projectId: f.projectId, id: saved.id }),
      ).rejects.toThrow("unavailable")
      expect(
        JSON.stringify(
          await f.admin.evidenceCaptures.list({
            projectId: f.projectId,
            query: {},
          }),
        ),
      ).not.toContain(canary)
      await f.publish(2)
      await expect(
        f.reader.evidenceCaptures.get({ projectId: f.projectId, id: saved.id }),
      ).rejects.toThrow("unavailable")
      const fresh = await capture(f)
      await connection.db.execute(
        sql`UPDATE workflow_runs SET started_at=clock_timestamp()-interval '31 days' WHERE id=${f.id}::uuid`,
      )
      expect(
        await f.admin.evidenceCaptures.get({
          projectId: f.projectId,
          id: fresh.id,
        }),
      ).toMatchObject({ available: false, reason: "Expired" })
      await expect(
        f.reader.evidenceCaptures.get({ projectId: f.projectId, id: fresh.id }),
      ).rejects.toThrow("unavailable")
      await expect(capture(f)).rejects.toThrow("unavailable")
    })
    it("requires current creator membership and a live delegated grant; removal destroys copies", async () => {
      const f = await fixture()
      await f.publish()
      const own = await f.reader.evidenceCaptures.create({
          projectId: f.projectId,
          command: { runId: f.id, title: "Reader copy" },
        }),
        preserved = await capture(f)
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
        await delegated.evidenceCaptures.get({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).toMatchObject({ available: true, canDelete: false })
      await expect(
        delegated.evidenceCaptures.create({
          projectId: f.projectId,
          command: { runId: f.id, title: "delegated" },
        }),
      ).rejects.toThrow()
      await expect(
        delegated.evidenceCaptures.delete({
          projectId: f.projectId,
          id: own.id,
        }),
      ).rejects.toThrow()
      const store = await run(
        EvidenceCaptureStore.make.pipe(
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
      await connection.db.insert(projectMembers).values({
        projectId: f.projectId,
        userId: f.business.userId,
        role: "business",
      })
      await expect(
        f.reader.evidenceCaptures.get({ projectId: f.projectId, id: own.id }),
      ).rejects.toThrow("unavailable")
      await expect(
        delegated.evidenceCaptures.get({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).rejects.toThrow()
      expect(
        await f.reader.evidenceCaptures.get({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).toMatchObject({ available: true })
    })
    it("enforces serial creator quotas, bounded pages and reader-bound cursors", async () => {
      const f = await fixture()
      await f.publish()
      await Promise.all(
        Array.range(1, 19).map((n) => capture(f, `Observation ${n}`)),
      )
      const final = await Promise.allSettled([
        capture(f, "final A"),
        capture(f, "final B"),
      ])
      expect(final.filter((x) => x.status === "fulfilled")).toHaveLength(1)
      expect(final.filter((x) => x.status === "rejected")).toHaveLength(1)
      const first = await f.admin.evidenceCaptures.list({
        projectId: f.projectId,
        query: { limit: 10 },
      })
      expect(first.items).toHaveLength(10)
      expect(first.nextCursor).toBeTruthy()
      const second = await f.admin.evidenceCaptures.list({
        projectId: f.projectId,
        query: { limit: 10, cursor: first.nextCursor! },
      })
      expect(second.items).toHaveLength(10)
      expect(second.nextCursor).toBeNull()
      expect(
        new Set([...first.items, ...second.items].map((x) => x.id)).size,
      ).toBe(20)
      await expect(
        f.reader.evidenceCaptures.list({
          projectId: f.projectId,
          query: { limit: 10, cursor: first.nextCursor! },
        }),
      ).rejects.toThrow()
      await expect(
        f.admin.evidenceCaptures.list({
          projectId: f.projectId,
          query: { limit: 26 },
        }),
      ).rejects.toThrow()
      await f.admin.evidenceCaptures.delete({
        projectId: f.projectId,
        id: first.items[0]!.id,
      })
      await capture(f, "reclaimed")
    }, 60000)
    it("counts unpurged expired captures toward the project-wide limit", async () => {
      const f = await fixture()
      await f.publish()
      const saved = await capture(f)
      const [row] = await connection.db
        .select()
        .from(evidenceCaptures)
        .where(eq(evidenceCaptures.id, saved.id))
      if (!row) {
        throw new Error("Expected persisted capture")
      }
      const extraA = await run(createDefinitionImportFixture(connection.db)),
        extraB = await run(createDefinitionImportFixture(connection.db))
      await connection.db.insert(projectMembers).values(
        Array.map([f.stranger, extraA, extraB], (member) => ({
          projectId: f.projectId,
          userId: member.userId,
          role: "business" as const,
        })),
      )
      const original = Schema.decodeUnknownSync(CapturedRunEvidenceSchema)(
        row.payload,
      )
      const members = [f.business, f.diagnostic, f.stranger, extraA, extraB]
      await connection.db.insert(evidenceCaptures).values(
        Array.flatMap(members, (member, index) =>
          Array.map(Array.range(1, index === 4 ? 19 : 20), () => {
            const id = randomUUID()
            return {
              ...row,
              id,
              creatorId: member.userId,
              payload: { ...original, id, creatorId: member.userId },
            }
          }),
        ),
      )
      await connection.db.execute(
        sql`UPDATE workflow_runs SET started_at=clock_timestamp()-interval '31 days' WHERE id=${f.id}::uuid`,
      )
      const externalId = randomUUID()
      await run(
        f.store.append(f.projectId, randomUUID(), {
          type: "started",
          workflow,
          runId: externalId,
          timestamp: new Date().toISOString(),
        }),
      )
      const fresh = (await run(f.store.listRuns(f.projectId, { workflow })))
        .runs[0]!
      await expect(
        f.admin.evidenceCaptures.create({
          projectId: f.projectId,
          command: { runId: fresh.id, title: "Fresh source" },
        }),
      ).rejects.toThrow("limit reached")
      expect(
        (
          await f.admin.evidenceCaptures.list({
            projectId: f.projectId,
            query: {},
          })
        ).items,
      ).toHaveLength(25)
    })
    it("waits for an in-flight source writer before projecting and committing", async () => {
      const f = await fixture()
      await f.publish()
      let release!: () => void, locked!: () => void
      const hold = new Promise<void>((resolve) => {
          release = resolve
        }),
        ready = new Promise<void>((resolve) => {
          locked = resolve
        })
      const writer = connection.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT id FROM workflow_runs WHERE id=${f.id}::uuid FOR UPDATE`,
        )
        locked()
        await hold
      })
      await ready
      const pending = capture(f)
      try {
        await vi.waitFor(
          async () => {
            const waiting = await connection.db.execute(
              sql`SELECT 1 FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE 'SELECT r.id FROM workflow_runs r JOIN workflows%'`,
            )
            expect(waiting.length).toBeGreaterThan(0)
          },
          { timeout: 2500, interval: 25 },
        )
      } finally {
        release()
        await writer
      }
      expect(await pending).toMatchObject({ id: expect.any(String) })
    })
    it("denies at the hard source deadline even before physical purge", async () => {
      const f = await fixture()
      await f.publish()
      await connection.db.execute(
        sql`UPDATE workflow_runs SET started_at=clock_timestamp()-interval '30 days'+interval '3 seconds' WHERE id=${f.id}::uuid`,
      )
      const saved = await capture(f)
      await vi.waitFor(
        async () => {
          expect(
            await f.admin.evidenceCaptures.get({
              projectId: f.projectId,
              id: saved.id,
            }),
          ).toMatchObject({ available: false, reason: "Expired" })
        },
        { timeout: 5000, interval: 100 },
      )
      await expect(
        f.reader.evidenceCaptures.get({ projectId: f.projectId, id: saved.id }),
      ).rejects.toThrow("unavailable")
      expect(
        await connection.db
          .select()
          .from(evidenceCaptures)
          .where(eq(evidenceCaptures.id, saved.id)),
      ).toHaveLength(1)
    })
    it("rejects cross-project source insertion and malformed stored envelopes", async () => {
      const f = await fixture()
      await f.publish()
      const saved = await capture(f)
      const [row] = await connection.db
        .select()
        .from(evidenceCaptures)
        .where(eq(evidenceCaptures.id, saved.id))
      if (!row) {
        throw new Error("Expected persisted capture")
      }
      await expect(
        connection.db.insert(evidenceCaptures).values({
          ...row,
          id: randomUUID(),
          projectId: f.owner.foreignProjectId,
        }),
      ).rejects.toThrow()
      const badId = randomUUID()
      await connection.db
        .insert(evidenceCaptures)
        .values({ ...row, id: badId, payload: { private: canary } })
      await expect(
        f.reader.evidenceCaptures.get({ projectId: f.projectId, id: badId }),
      ).rejects.toThrow("unavailable")
      expect(
        await f.admin.evidenceCaptures.get({
          projectId: f.projectId,
          id: badId,
        }),
      ).toMatchObject({ available: false, reason: "Invalid" })
    })
    it("keeps hosted capture disabled even with otherwise valid local test proof", async () => {
      const f = await fixture()
      vi.stubEnv("VERCEL", "1")
      try {
        expect(
          await f.admin.evidenceCaptures.capabilities({
            projectId: f.projectId,
          }),
        ).toMatchObject({ enabled: false })
        await expect(capture(f)).rejects.toThrow("local development")
        await expect(
          f.admin.evidenceCaptures.list({ projectId: f.projectId, query: {} }),
        ).rejects.toThrow("local development")
      } finally {
        vi.stubEnv("VERCEL", "")
      }
    })
    it("drains creator copies during account erasure without changing another member's questions", async () => {
      const f = await fixture()
      await f.reader.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: f.id, title: "Captured observation" },
      })
      const preserved = await f.admin.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: f.id, title: "Captured observation" },
      })
      const stale = await f.reader.accountLifecycle.preview()
      await f.reader.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: f.id, title: "Created after account preview" },
      })
      await expect(
        f.reader.accountLifecycle.confirm({
          operationId: stale.operation.id,
          confirmation: "DELETE MY ACCOUNT",
          password: f.business.password,
        }),
      ).rejects.toThrow(/preview/i)
      const preview = await f.reader.accountLifecycle.preview()
      const confirmed = await f.reader.accountLifecycle.confirm({
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
          .from(evidenceCaptures)
          .where(eq(evidenceCaptures.creatorId, f.business.userId)),
      ).toHaveLength(0)
      expect(
        await f.viewer.evidenceCaptures.get({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).toMatchObject({ available: true, capture: { id: preserved.id } })
    })
    it("drains captures during project deletion through the existing bounded phase", async () => {
      const f = await fixture()
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.diagnostic.userId,
      })
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      await f.admin.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: f.id, title: "Captured observation" },
      })
      const stale = await f.admin.dataLifecycle.preview({
        projectId: f.projectId,
        scope: { kind: "project" },
      })
      await capture(f, "Created after project preview")
      await expect(
        f.admin.dataLifecycle.confirm({
          projectId: f.projectId,
          operationId: stale.id,
          confirmation: "Booking setup",
          password: f.owner.password,
        }),
      ).rejects.toThrow(/preview/i)
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
      expect((await run(Ref.get(progress))).deletedRuns).toBe(1)
      expect(
        await connection.db
          .select()
          .from(evidenceCaptures)
          .where(eq(evidenceCaptures.projectId, f.projectId)),
      ).toEqual([])
    })
  },
)
