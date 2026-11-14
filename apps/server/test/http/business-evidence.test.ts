import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { Effect, Array, Ref, Redacted } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projectMembers,
  user,
  projectEvidencePublications,
} from "@flowmark/db"
import {
  Database,
  WorkflowStore,
  BusinessEvidenceStore,
  ProjectReadSubject,
  ResultDeclarationStore,
} from "@flowmark/db/persistence"
import { appRouter } from "../../src/adapters/trpc/router"
import { Email, makeEmailCapture } from "@flowmark/email"
import { PersistenceError } from "@flowmark/api"
import * as sharingBoundary from "../../src/adapters/trpc/project-sharing-boundary"
import { getAuth, resetAuthCacheForTests } from "../../src/auth"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"
const origin = "http://localhost:3001",
  workflow = "business.orders",
  canary = "PRIVATE_DIAGNOSTIC_CANARY"
const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect)
describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "published business evidence",
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
    it("defaults to metadata only and projects exactly published result/reference evidence", async () => {
      const f = await fixture()
      const before = await f.reader.businessEvidence.read({
        kind: "run",
        runId: f.id,
      })
      expect(before.data).toMatchObject({
        kind: "run",
        fields: [],
        references: [],
      })
      expect(JSON.stringify(before)).not.toContain(canary)
      expect(
        JSON.stringify(
          await f.reader.businessEvidence.read({ kind: "overview" }),
        ),
      ).not.toContain(canary)
      await f.publish()
      const evidence = await f.reader.businessEvidence.read({
        kind: "run",
        runId: f.id,
      })
      expect(evidence.projection).toMatchObject({
        depth: "business",
        publicationRevision: 1,
      })
      expect(evidence.data).toMatchObject({
        fields: [{ label: "Accepted bookings", value: 3 }],
        references: [{ key: "customer", value: "customer-1" }],
      })
      expect(JSON.stringify(evidence)).not.toContain(canary)
      const journey = await f.reader.businessEvidence.read({
        kind: "journey",
        query: {
          workflow,
          key: "customer",
          value: "customer-1",
          namespaces: [{ workflow, key: "customer" }],
        },
      })
      expect(JSON.stringify(journey)).not.toContain(canary)
      expect(journey.data.kind).toBe("journey")
      const diagnostic = await f.viewer.run.detail({ id: f.id })
      expect(JSON.stringify(diagnostic)).toContain(canary)
      expect(
        await f.viewer.businessEvidence.read({ kind: "run", runId: f.id }),
      ).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({ kind: "run" }),
        }),
      )
    })
    it("denies every legacy diagnostic read and meaning route before raw evidence leaves", async () => {
      const f = await fixture()
      await f.publish()
      const requests = [
        () => f.reader.project.snapshot(),
        () =>
          f.reader.project.periodReport({
            currentStartedAfter: "2026-11-01T00:00:00.000Z",
            currentStartedBefore: "2026-11-02T00:00:00.000Z",
            previousStartedAfter: "2026-10-31T00:00:00.000Z",
            previousStartedBefore: "2026-11-01T00:00:00.000Z",
          }),
        () => f.reader.run.detail({ id: f.id }),
        () => f.reader.run.investigationSummary({ id: f.id }),
        () => f.reader.run.eventPage({ runId: f.id }),
        () => f.reader.run.operationsPage({ runId: f.id }),
        () => f.reader.run.expectationsPage({ runId: f.id }),
        () => f.reader.run.relatedPage({ runId: f.id }),
        () => f.reader.run.list({}),
        () => f.reader.run.compare({ id: f.id }),
        () => f.reader.workflow.discover({}),
        () =>
          f.reader.resultDeclarations.list({
            projectId: f.projectId,
            workflow,
          }),
        () =>
          f.reader.resultDeclarations.searchFields({
            projectId: f.projectId,
            workflow,
          }),
        () => f.reader.project.keys(f.projectId),
        () =>
          f.reader.businessEvidence.configuration({ projectId: f.projectId }),
        () => f.outsider.businessEvidence.read({ kind: "run", runId: f.id }),
      ]
      await run(
        Effect.forEach(
          requests,
          (request) =>
            Effect.promise(async () => {
              await expect(request()).rejects.toMatchObject({
                code: "UNAUTHORIZED",
              })
            }),
          { concurrency: 4 },
        ),
      )
      await expect(
        run(
          f.store.snapshot(f.projectId).pipe(
            Effect.provideService(ProjectReadSubject, {
              kind: "user",
              userId: f.business.userId,
            }),
          ),
        ),
      ).rejects.toThrow()
      const declarations = await run(
        ResultDeclarationStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await expect(
        run(declarations.list(f.business.userId, f.projectId, workflow)),
      ).rejects.toThrow()
    }, 15000)
    it("rejects hidden selectors and foreign scopes without exposing an oracle", async () => {
      const f = await fixture()
      await f.publish()
      await expect(
        f.reader.businessEvidence.read({
          kind: "runs",
          query: { workflow, businessKey: "private", businessValue: canary },
        }),
      ).rejects.toThrow("withheld")
      await expect(
        f.reader.businessEvidence.read({
          kind: "runs",
          query: { workflow, environment: canary } as never,
        }),
      ).rejects.toThrow()
      await expect(
        f.reader.businessEvidence.read({ kind: "run", runId: randomUUID() }),
      ).rejects.toThrow()
      await expect(
        caller(
          f.business.cookie,
          f.owner.foreignProjectId,
        ).businessEvidence.read({ kind: "overview" }),
      ).rejects.toThrow()
      const now = new Date().toISOString(),
        before = new Date(Date.now() - 86400000).toISOString(),
        previous = new Date(Date.now() - 2 * 86400000).toISOString()
      const query = {
        workflow,
        revision: "v1",
        path: ["accepted"],
        currentStartedAfter: before,
        currentStartedBefore: now,
        previousStartedAfter: previous,
        previousStartedBefore: before,
      }
      const report = await f.reader.businessEvidence.read({
        kind: "insights",
        query,
      })
      expect(JSON.stringify(report)).not.toContain(canary)
      expect(report.data).toMatchObject({
        kind: "insights",
        report: {
          windows: [expect.objectContaining({ total: "3" }), expect.anything()],
        },
      })
      await expect(
        f.reader.businessEvidence.read({
          kind: "insights",
          query: { ...query, path: ["private"] },
        }),
      ).rejects.toThrow("withheld")
    })
    it("serializes publication replacements and immediately removes previously published values", async () => {
      const f = await fixture()
      await f.publish()
      const selection = {
        version: 1 as const,
        kind: "run" as const,
        projectId: f.projectId,
        runId: f.id,
        section: "events" as const,
      }
      const saved = await f.reader.investigations.save({
        projectId: f.projectId,
        command: { title: "Live published result", selection },
      })
      expect(saved.selection).toEqual(selection)
      expect(
        await f.admin.investigations.get({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).toBeNull()
      expect(
        await f.reader.investigations.get({
          projectId: f.projectId,
          id: saved.id,
        }),
      ).toMatchObject({ selection })
      await expect(f.publish(0)).rejects.toThrow("changed")
      await f.admin.businessEvidence.replace({
        projectId: f.projectId,
        expectedRevision: 1,
        publication: { results: [], references: [] },
      })
      const after = await f.reader.businessEvidence.read({
        kind: "run",
        runId: f.id,
      })
      expect(after.data).toMatchObject({
        kind: "run",
        fields: [],
        references: [],
      })
      expect(after.projection.publicationRevision).toBe(2)
      const prior = await connection.db
        .select()
        .from(projectEvidencePublications)
        .where(eq(projectEvidencePublications.projectId, f.projectId))
      await expect(
        f.admin.businessEvidence.replace({
          projectId: f.projectId,
          expectedRevision: 2,
          publication: {
            results: [{ workflow, revision: "v1", paths: [["not-declared"]] }],
            references: [],
          },
        }),
      ).rejects.toThrow()
      expect(
        await connection.db
          .select()
          .from(projectEvidencePublications)
          .where(eq(projectEvidencePublications.projectId, f.projectId)),
      ).toEqual(prior)
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      await expect(
        f.reader.businessEvidence.read({ kind: "overview" }),
      ).rejects.toThrow()
      await expect(
        f.reader.investigations.list({ projectId: f.projectId, query: {} }),
      ).rejects.toThrow()
      await expect(
        f.reader.investigations.get({ projectId: f.projectId, id: saved.id }),
      ).rejects.toThrow()
    })
    it("accepts the exact business level from captured mail, never from recipient input", async () => {
      const f = await fixture()
      await connection.db
        .update(user)
        .set({ emailVerified: true })
        .where(sql`${user.id} IN (${f.owner.userId}, ${f.stranger.userId})`)
      const auth = await run(getAuth())
      const owner = await auth.api.getSession({
        headers: { cookie: f.owner.cookie },
        query: { disableCookieCache: true },
      })
      const recipient = await auth.api.getSession({
        headers: { cookie: f.stranger.cookie },
        query: { disableCookieCache: true },
      })
      const capture = await run(makeEmailCapture(origin, "local"))
      const email = await run(Email.pipe(Effect.provide(capture.layer)))
      const mock = vi
        .spyOn(sharingBoundary, "sharingNotifications")
        .mockReturnValue({
          recipientKey: () => Effect.succeed("synthetic-recipient"),
          send: (message, token) =>
            email
              .send({
                kind: "project-invitation",
                role: message.role,
                to: message.email,
                messageId: message.id,
                projectName: message.projectName,
                inviterName: message.inviterName,
                actionUrl: `${origin}/invitations/${message.id}?token=${Redacted.value(token)}`,
              })
              .pipe(
                Effect.mapError(
                  (cause) =>
                    new PersistenceError({ operation: "test-mail", cause }),
                ),
              ),
        })
      try {
        await f.admin.projectSharing.invite({
          projectId: f.projectId,
          email: recipient!.user.email,
          password: f.owner.password,
          currentSessionId: owner!.session.id,
          role: "business",
        })
        const message = (await run(capture.read)).at(-1)!
        expect(message.text).toContain("owner-published")
        expect(message.text).not.toContain("all diagnostic evidence")
        const url = new URL(
          message.text.match(/Review project invitation: (\S+)/)![1],
        )
        const proof = {
          id: url.pathname.split("/").at(-1)!,
          token: url.searchParams.get("token")!,
          currentSessionId: recipient!.session.id,
          action: "accept" as const,
        }
        await expect(
          f.outsider.projectSharing.review({
            ...proof,
            role: "viewer",
          } as never),
        ).rejects.toThrow()
        expect(await f.outsider.projectSharing.review(proof)).toMatchObject({
          role: "business",
          action: "accept",
        })
        await expect(f.outsider.run.detail({ id: f.id })).rejects.toThrow()
        expect((await f.outsider.businessEvidence.capabilities()).depth).toBe(
          "business",
        )
        await expect(f.outsider.projectSharing.review(proof)).rejects.toThrow()
      } finally {
        mock.mockRestore()
      }
    })

    it("deletes a business reader's own account without erasing shared evidence", async () => {
      const f = await fixture()
      await f.publish()
      await expect(f.admin.accountLifecycle.preview()).rejects.toThrow(
        "shared ownership",
      )
      const preview = await f.reader.accountLifecycle.preview()
      const confirmed = await f.reader.accountLifecycle.confirm({
        operationId: preview.operation.id,
        confirmation: "DELETE MY ACCOUNT",
        password: f.business.password,
      })
      expect(await f.admin.project.snapshot()).toBeDefined()
      await f.admin.projectSharing.remove({
        projectId: f.projectId,
        userId: f.business.userId,
      })
      const progress = await run(Ref.make(confirmed))
      await run(
        Effect.forEach(Array.range(1, 80), () =>
          Effect.gen(function* () {
            if ((yield* Ref.get(progress)).state !== "live_data_deleted") {
              const next = yield* Effect.promise(() =>
                caller("").accountLifecycle.resume({
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
          .from(user)
          .where(eq(user.id, f.business.userId)),
      ).toEqual([])
      expect(await f.admin.project.snapshot()).toBeDefined()
      expect(
        await connection.db
          .select()
          .from(projectEvidencePublications)
          .where(eq(projectEvidencePublications.projectId, f.projectId)),
      ).toHaveLength(1)
    }, 30000)
    it("binds real pages to publication and serializes concurrent policy changes", async () => {
      const f = await fixture()
      await f.publish()
      const external = randomUUID(),
        stamp = new Date(Date.now() - 2000).toISOString()
      await run(
        f.store.append(f.projectId, randomUUID(), {
          type: "started",
          workflow,
          runId: external,
          timestamp: stamp,
          properties: {
            definitionRevision: "v1",
            customer: "customer-1",
            private: canary,
          },
        }),
      )
      const openWorkflow = "business.unfinished"
      await run(
        f.store.append(f.projectId, randomUUID(), {
          type: "started",
          workflow: openWorkflow,
          runId: randomUUID(),
          timestamp: stamp,
        }),
      )
      const metadata = await f.reader.businessEvidence.read({
        kind: "overview",
        workflow: openWorkflow,
      })
      expect(metadata.data).toMatchObject({
        kind: "overview",
        workflows: [
          {
            name: openWorkflow,
            runs: 1,
            completedPercent: null,
            medianDurationMs: null,
            p95DurationMs: null,
          },
        ],
      })
      const query = { workflow, limit: 1 }
      const first = await f.reader.businessEvidence.read({
        kind: "runs",
        query,
      })
      expect(first.data.kind).toBe("runs")
      if (first.data.kind !== "runs" || first.data.nextCursor === null) {
        throw new Error("Missing projected continuation")
      }
      const nextCursor = first.data.nextCursor
      const second = await f.reader.businessEvidence.read({
        kind: "runs",
        query: { ...query, cursor: nextCursor },
      })
      expect(second.data.kind).toBe("runs")
      if (second.data.kind === "runs") {
        expect(second.data.runs[0]?.id).not.toBe(first.data.runs[0]?.id)
      }
      await expect(
        caller(f.business.cookie, f.business.projectId).businessEvidence.read({
          kind: "runs",
          query: { ...query, cursor: nextCursor },
        }),
      ).rejects.toThrow()
      const outcomes = await Promise.allSettled([
        f.admin.businessEvidence.replace({
          projectId: f.projectId,
          expectedRevision: 1,
          publication: f.publication,
        }),
        f.admin.businessEvidence.replace({
          projectId: f.projectId,
          expectedRevision: 1,
          publication: { results: [], references: [] },
        }),
      ])
      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1)
      await expect(
        f.reader.businessEvidence.read({
          kind: "runs",
          query: { ...query, cursor: nextCursor },
        }),
      ).rejects.toThrow("changed")
      const repository = await run(
        BusinessEvidenceStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      const admittedBeforeRemoval = repository
        .withRead(f.projectId, () =>
          Effect.succeed("must not reach the response"),
        )
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
      await expect(run(admittedBeforeRemoval)).rejects.toThrow()
    })
  },
)
