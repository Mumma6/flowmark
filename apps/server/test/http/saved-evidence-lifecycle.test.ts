import { CapturedRunEvidenceSchema } from "@flowmark/api"
import {
  evidenceCaptures,
  savedInvestigations,
  workflowRuns,
  oauthClient,
  oauthRefreshToken,
  agentAccessGrantProjects,
} from "@flowmark/db"
import {
  EvidenceCaptureStore,
  InvestigationStore,
} from "@flowmark/db/persistence"
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
  "saved evidence expiry and export lifecycle",
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
      appRouter.createCaller(() => ({
        request: new Request(origin + "/api/trpc", {
          headers: {
            cookie,
            origin,
            ...(projectId ? { "x-flowmark-project-id": projectId } : {}),
            ...extra,
          },
        }),
      }))
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

    type Fixture = Awaited<ReturnType<typeof fixture>>
    const capture = (f: Fixture, title = "Business observation") =>
      f.admin.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: f.id, title },
      })
    const selection = (f: Fixture) => ({
      version: 1 as const,
      kind: "run" as const,
      projectId: f.projectId,
      runId: f.id,
      section: "events" as const,
    })
    const share = (f: Fixture, depth: "business" | "diagnostic" = "business") =>
      f.admin.sharedInvestigations.create({
        projectId: f.projectId,
        command: {
          title: "Shared question",
          selection:
            depth === "business"
              ? {
                  version: 1,
                  depth,
                  query: {
                    kind: "journey",
                    query: {
                      workflow,
                      key: "customer",
                      value: "customer-1",
                      namespaces: [{ workflow, key: "customer" }],
                    },
                  },
                }
              : { version: 1, depth, query: selection(f) },
        },
      })
    const grant = async (f: Fixture) => {
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
      return caller(f.business.cookie, f.projectId, {
        "x-flowmark-grant-client-id": clientId,
        "x-flowmark-grant-authorization-code-id": family,
      })
    }
    it("exports fresh authorized DTOs with explicit live/past semantics and no raw evidence", async () => {
      const f = await fixture()
      await f.publish()
      const own = await f.admin.investigations.save({
        projectId: f.projectId,
        command: { title: "Owner selection", selection: selection(f) },
      })
      const privateExport = await f.admin.investigations.export({
        projectId: f.projectId,
        id: own.id,
      })
      expect(privateExport).toMatchObject({
        version: 1,
        kind: "live-question",
        visibility: "private",
        data: { id: own.id, selection: selection(f) },
      })
      expect(privateExport.notice).toContain("recomputes")
      expect(Date.parse(privateExport.exportedAt)).not.toBeNaN()
      await expect(
        f.viewer.investigations.export({ projectId: f.projectId, id: own.id }),
      ).rejects.toThrow("unavailable")
      await expect(
        f.outsider.investigations.export({
          projectId: f.projectId,
          id: own.id,
        }),
      ).rejects.toThrow()
      const shared = await share(f),
        diagnostic = await share(f, "diagnostic"),
        saved = await capture(f)
      const live = await f.reader.sharedInvestigations.export({
        projectId: f.projectId,
        id: shared.id,
      })
      expect(live).toMatchObject({
        kind: "live-question",
        visibility: "project",
        data: { id: shared.id, depth: "business" },
      })
      expect(JSON.stringify(live)).not.toContain(canary)
      await expect(
        f.reader.sharedInvestigations.export({
          projectId: f.projectId,
          id: diagnostic.id,
        }),
      ).rejects.toThrow("unavailable")
      const observed = await f.reader.evidenceCaptures.get({
        projectId: f.projectId,
        id: saved.id,
      })
      await connection.db.execute(
        sql`UPDATE workflow_run_facts SET result='{"accepted":9}'::jsonb WHERE run_id=${f.id}::uuid`,
      )
      const exported = await f.reader.evidenceCaptures.export({
        projectId: f.projectId,
        id: saved.id,
      })
      expect(exported).toMatchObject({
        version: 1,
        kind: "captured-observation",
        visibility: "project",
        data: observed,
      })
      expect(exported.notice).toContain("cannot be recalled")
      expect(JSON.stringify(exported)).not.toContain(canary)
      expect(JSON.stringify(exported)).toContain('"value":3')
      const delegated = await grant(f)
      expect(
        await delegated.evidenceCaptures.export({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).toMatchObject({ data: { available: true, canDelete: false } })
      expect(
        await delegated.sharedInvestigations.export({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).toMatchObject({ data: { depth: "business" } })
      await expect(
        delegated.investigations.export({ projectId: f.projectId, id: own.id }),
      ).rejects.toThrow()
      const key = caller("", f.projectId, {
        authorization: `Bearer ${f.owner.readKey}`,
      })
      await expect(
        key.evidenceCaptures.export({ projectId: f.projectId, id: saved.id }),
      ).rejects.toThrow()
      await expect(
        key.sharedInvestigations.export({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow()
      await expect(
        key.investigations.export({ projectId: f.projectId, id: own.id }),
      ).rejects.toThrow()
      await expect(
        f.admin.evidenceCaptures.export({
          projectId: f.projectId,
          id: saved.id,
          payload: { rawEvents: canary },
        } as never),
      ).rejects.toThrow()
      await f.admin.businessEvidence.replace({
        projectId: f.projectId,
        expectedRevision: 1,
        publication: { results: [], references: [] },
      })
      await expect(
        f.admin.evidenceCaptures.export({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        delegated.evidenceCaptures.export({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        f.admin.sharedInvestigations.export({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).rejects.toThrow("unavailable")
    })
    it("checks current diagnostic depth inside private export reads and refuses unsupported private versions", async () => {
      const f = await fixture()
      const saved = await f.viewer.investigations.save({
        projectId: f.projectId,
        command: { title: "My diagnostic question", selection: selection(f) },
      })
      expect(
        await f.viewer.investigations.export({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).toMatchObject({ visibility: "private" })
      const store = await run(
        InvestigationStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      const delayed = store.get(
        f.diagnostic.userId,
        f.projectId,
        saved.id,
        "diagnostic",
      )
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.diagnostic.userId,
      })
      await connection.db.insert(projectMembers).values({
        projectId: f.projectId,
        userId: f.diagnostic.userId,
        role: "business",
      })
      await expect(run(delayed)).rejects.toThrow()
      await expect(
        f.viewer.investigations.export({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).rejects.toThrow()
      expect(
        await f.viewer.investigations.get({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).toMatchObject({ id: saved.id })
      const own = await f.admin.investigations.save({
        projectId: f.projectId,
        command: { title: "Unsupported", selection: selection(f) },
      })
      await connection.db
        .update(savedInvestigations)
        .set({ selection: { version: 99, secret: canary } })
        .where(eq(savedInvestigations.id, own.id))
      await expect(
        f.admin.investigations.export({ projectId: f.projectId, id: own.id }),
      ).rejects.toThrow("unavailable")
    })
    it("denies exports after creator removal, grant revocation and hard expiry; expired reinsertion never revives an ID", async () => {
      const f = await fixture()
      await f.publish()
      const own = await f.reader.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: f.id, title: "Creator copy" },
      })
      const live = await f.reader.sharedInvestigations.create({
        projectId: f.projectId,
        command: {
          title: "Creator question",
          selection: {
            version: 1,
            depth: "business",
            query: { kind: "run", runId: f.id },
          },
        },
      })
      const delegated = await grant(f),
        preserved = await capture(f)
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      await expect(
        f.viewer.evidenceCaptures.export({
          projectId: f.projectId,
          id: own.id,
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        f.viewer.sharedInvestigations.export({
          projectId: f.projectId,
          id: live.id,
        }),
      ).rejects.toThrow("unavailable")
      await connection.db.insert(projectMembers).values({
        userId: f.business.userId,
        projectId: f.projectId,
        role: "business",
      })
      await expect(
        f.reader.evidenceCaptures.export({
          projectId: f.projectId,
          id: own.id,
        }),
      ).rejects.toThrow("unavailable")
      await expect(
        delegated.evidenceCaptures.export({
          projectId: f.projectId,
          id: preserved.id,
        }),
      ).rejects.toThrow()
      await connection.db.execute(
        sql`UPDATE workflow_runs SET started_at=clock_timestamp()-interval '30 days'+interval '3 seconds' WHERE id=${f.id}::uuid`,
      )
      const near = await capture(f)
      const [original] = await connection.db
        .select()
        .from(evidenceCaptures)
        .where(eq(evidenceCaptures.id, near.id))
      if (!original) {
        throw new Error("Missing capture fixture")
      }
      await vi.waitFor(
        async () => {
          expect(
            await f.admin.evidenceCaptures.get({
              projectId: f.projectId,
              id: near.id,
            }),
          ).toMatchObject({ available: false, reason: "Expired" })
        },
        { timeout: 6000, interval: 100 },
      )
      await expect(
        f.admin.evidenceCaptures.export({
          projectId: f.projectId,
          id: near.id,
        }),
      ).rejects.toThrow("unavailable")
      expect(
        await f.admin.evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).toMatchObject({ deleted: 2, hasMore: false })
      await expect(
        connection.db.insert(evidenceCaptures).values(original),
      ).rejects.toThrow()
      await expect(
        f.admin.evidenceCaptures.get({ projectId: f.projectId, id: near.id }),
      ).rejects.toThrow("unavailable")
    })
    it("rolls back failed cleanup, resumes in bounded batches and preserves fresh/foreign evidence", async () => {
      const f = await fixture()
      await f.publish()
      const seed = await capture(f, "synthetic-expiry-failure")
      const [row] = await connection.db
        .select()
        .from(evidenceCaptures)
        .where(eq(evidenceCaptures.id, seed.id))
      if (!row) {
        throw new Error("Missing capture fixture")
      }
      const original = Schema.decodeUnknownSync(CapturedRunEvidenceSchema)(
        row.payload,
      )
      const freshExternal = randomUUID()
      await run(
        f.store.append(f.projectId, randomUUID(), {
          type: "started",
          workflow,
          runId: freshExternal,
          timestamp: new Date().toISOString(),
        }),
      )
      const freshRun = (await run(f.store.listRuns(f.projectId, { workflow })))
        .runs[0]!
      const fresh = await f.admin.evidenceCaptures.create({
        projectId: f.projectId,
        command: { runId: freshRun.id, title: "Fresh" },
      })
      await connection.db.insert(evidenceCaptures).values(
        Array.flatMap(
          [
            { id: f.owner.userId, n: 18 },
            { id: f.business.userId, n: 20 },
            { id: f.diagnostic.userId, n: 12 },
          ],
          (member) =>
            Array.map(Array.range(1, member.n), () => {
              const id = randomUUID()
              return {
                ...row,
                id,
                creatorId: member.id,
                payload: { ...original, id, creatorId: member.id },
              }
            }),
        ),
      )
      const foreign = caller(f.business.cookie, f.business.projectId)
      await run(
        f.store.append(f.business.projectId, randomUUID(), {
          type: "started",
          workflow,
          runId: randomUUID(),
          timestamp: new Date().toISOString(),
        }),
      )
      const foreignRun = (
        await run(f.store.listRuns(f.business.projectId, { workflow }))
      ).runs[0]!
      const foreignCapture = await foreign.evidenceCaptures.create({
        projectId: f.business.projectId,
        command: { runId: foreignRun.id, title: "Other project" },
      })
      await connection.db.execute(
        sql`UPDATE workflow_runs SET started_at=clock_timestamp()-interval '31 days' WHERE id=${f.id}::uuid`,
      )
      expect(
        await f.admin.evidenceCaptures.capabilities({ projectId: f.projectId }),
      ).toMatchObject({ canPurge: true })
      expect(
        await f.reader.evidenceCaptures.capabilities({
          projectId: f.projectId,
        }),
      ).toMatchObject({ canPurge: false })
      await expect(
        f.reader.evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).rejects.toThrow()
      await expect(
        caller(f.owner.cookie, f.projectId, {
          origin: "https://evil.invalid",
        }).evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).rejects.toThrow()
      await expect(
        caller("", f.projectId, {
          authorization: `Bearer ${f.owner.readKey}`,
        }).evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).rejects.toThrow()
      const store = await run(
        EvidenceCaptureStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await expect(
        run(
          store
            .withAccess(f.projectId, false, (a) => a.purgeExpired())
            .pipe(
              Effect.provideService(ProjectReadSubject, {
                kind: "user",
                userId: f.owner.userId,
              }),
            ),
        ),
      ).rejects.toThrow()
      const name = sql.identifier(
        "test_expiry_" + randomUUID().replaceAll("-", ""),
      )
      await connection.db.execute(
        sql`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.payload->>'title'='synthetic-expiry-failure' THEN RAISE EXCEPTION 'Synthetic expiry failure'; END IF; RETURN OLD; END; $$`,
      )
      await connection.db.execute(
        sql`CREATE TRIGGER ${name} BEFORE DELETE ON evidence_captures FOR EACH ROW EXECUTE FUNCTION ${name}()`,
      )
      try {
        await expect(
          f.admin.evidenceCaptures.purgeExpired({ projectId: f.projectId }),
        ).rejects.toThrow()
        expect(
          await connection.db
            .select()
            .from(evidenceCaptures)
            .where(eq(evidenceCaptures.projectId, f.projectId)),
        ).toHaveLength(52)
      } finally {
        await connection.db.execute(
          sql`DROP TRIGGER ${name} ON evidence_captures`,
        )
        await connection.db.execute(sql`DROP FUNCTION ${name}()`)
      }
      expect(
        await f.admin.evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).toEqual({ deleted: 25, hasMore: true })
      expect(
        await f.admin.evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).toEqual({ deleted: 25, hasMore: true })
      expect(
        await f.admin.evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).toEqual({ deleted: 1, hasMore: false })
      expect(
        await f.admin.evidenceCaptures.purgeExpired({ projectId: f.projectId }),
      ).toEqual({ deleted: 0, hasMore: false })
      expect(
        await f.admin.evidenceCaptures.export({
          projectId: f.projectId,
          id: fresh.id,
        }),
      ).toMatchObject({ data: { available: true } })
      expect(
        await foreign.evidenceCaptures.get({
          projectId: f.business.projectId,
          id: foreignCapture.id,
        }),
      ).toMatchObject({ available: true })
    }, 60000)
    it("includes personal and shared metadata in account deletion previews", async () => {
      const f = await fixture()
      const account = await f.reader.accountLifecycle.preview()
      await f.reader.investigations.save({
        projectId: f.projectId,
        command: {
          title: "Private in a shared project",
          selection: selection(f),
        },
      })
      await expect(
        f.reader.accountLifecycle.confirm({
          operationId: account.operation.id,
          confirmation: "DELETE MY ACCOUNT",
          password: f.business.password,
        }),
      ).rejects.toThrow(/preview/i)
      const refreshed = await f.reader.accountLifecycle.preview()
      await f.reader.sharedInvestigations.create({
        projectId: f.projectId,
        command: {
          title: "Shared after preview",
          selection: {
            version: 1,
            depth: "business",
            query: { kind: "run", runId: f.id },
          },
        },
      })
      await expect(
        f.reader.accountLifecycle.confirm({
          operationId: refreshed.operation.id,
          confirmation: "DELETE MY ACCOUNT",
          password: f.business.password,
        }),
      ).rejects.toThrow(/preview/i)
    })
    it("includes shared metadata in project deletion previews", async () => {
      const f = await fixture()
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.diagnostic.userId,
      })
      const before = await f.admin.dataLifecycle.preview({
        projectId: f.projectId,
        scope: { kind: "project" },
      })
      await share(f, "diagnostic")
      await expect(
        f.admin.dataLifecycle.confirm({
          projectId: f.projectId,
          operationId: before.id,
          confirmation: "Booking setup",
          password: f.owner.password,
        }),
      ).rejects.toThrow(/preview/i)
      const after = await f.admin.dataLifecycle.preview({
        projectId: f.projectId,
        scope: { kind: "project" },
      })
      expect(after.counts.configurations).toBe(before.counts.configurations + 1)
    })
    it("drains captures before scoped source erasure while retaining live-question metadata", async () => {
      const f = await fixture()
      await f.publish()
      const captured = await capture(f),
        shared = await f.admin.sharedInvestigations.create({
          projectId: f.projectId,
          command: {
            title: "Live source question",
            selection: {
              version: 1,
              depth: "business",
              query: { kind: "run", runId: f.id },
            },
          },
        })
      const personal = await f.admin.investigations.save({
        projectId: f.projectId,
        command: { title: "Private source question", selection: selection(f) },
      })
      const [old] = await connection.db
        .select()
        .from(evidenceCaptures)
        .where(eq(evidenceCaptures.id, captured.id))
      if (!old) {
        throw new Error("Missing capture fixture")
      }
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.diagnostic.userId,
      })
      const preview = await f.admin.dataLifecycle.preview({
        projectId: f.projectId,
        scope: { kind: "runs", runIds: [f.id] },
      })
      const confirmed = await f.admin.dataLifecycle.confirm({
        projectId: f.projectId,
        operationId: preview.id,
        confirmation: "Booking setup",
        password: f.owner.password,
      })
      await expect(
        f.admin.evidenceCaptures.export({
          projectId: f.projectId,
          id: captured.id,
        }),
      ).rejects.toThrow()
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
      expect(await run(Ref.get(progress))).toMatchObject({
        state: "live_data_deleted",
        deletedRuns: 1,
      })
      expect(
        await connection.db
          .select()
          .from(workflowRuns)
          .where(eq(workflowRuns.id, f.id)),
      ).toHaveLength(0)
      expect(
        await connection.db
          .select()
          .from(evidenceCaptures)
          .where(eq(evidenceCaptures.id, captured.id)),
      ).toHaveLength(0)
      await expect(
        connection.db.insert(evidenceCaptures).values(old),
      ).rejects.toThrow()
      await expect(
        f.admin.evidenceCaptures.export({
          projectId: f.projectId,
          id: captured.id,
        }),
      ).rejects.toThrow("unavailable")
      expect(
        await f.admin.sharedInvestigations.export({
          projectId: f.projectId,
          id: shared.id,
        }),
      ).toMatchObject({ kind: "live-question" })
      expect(
        await f.admin.investigations.export({
          projectId: f.projectId,
          id: personal.id,
        }),
      ).toMatchObject({ kind: "live-question", visibility: "private" })
      await expect(
        run(
          f.store.append(f.projectId, randomUUID(), {
            type: "started",
            workflow,
            runId: randomUUID(),
            timestamp: new Date(Date.now() - 60000).toISOString(),
          }),
        ),
      ).rejects.toThrow()
    })
  },
)
