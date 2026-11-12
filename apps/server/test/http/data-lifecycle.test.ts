import { randomUUID } from "node:crypto"
import { and, eq, sql } from "drizzle-orm"
import { Array, Deferred, Effect, Exit, Ref } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projects,
  projectMembers,
  projectApiKeys,
  projectBrowserKeys,
  workflowEvents,
  workflowRuns,
  workflows,
  workflowResultDeclarations,
  workflowSearchFields,
  workflowDefinitionImports,
  savedInvestigations,
  agentAccessGrantProjects,
  workflowExpectations,
  workflowRunFacts,
  workflowMetricFacts,
} from "@flowmark/db"
import {
  DataLifecycleStore,
  Database,
  WorkflowStore,
  hashApiKey,
} from "@flowmark/db/persistence"
import { IngestWorkflowEvents, runApi } from "@flowmark/api"
import { appRouter } from "../../src/adapters/trpc/router"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "complete data lifecycle",
  () => {
    let connection: ReturnType<typeof createDatabase>
    const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
      Effect.runPromise(effect)
    const fixture = () => run(createDefinitionImportFixture(connection.db))
    type Fixture = Awaited<ReturnType<typeof fixture>>
    const caller = (value: Fixture, origin = "http://localhost:3001") =>
      appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: { cookie: value.cookie, origin },
        }),
      })
    const store = () =>
      run(
        DataLifecycleStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
    const send = (
      projectId: string,
      runId = randomUUID(),
      workflow = "erasure.test",
      timestamp = new Date(Date.now() - 10000).toISOString(),
    ) =>
      run(
        Effect.gen(function* () {
          const writer = yield* WorkflowStore.make
          yield* writer.append(projectId, randomUUID(), {
            type: "started",
            workflow,
            runId,
            timestamp,
          })
          yield* writer.append(projectId, randomUUID(), {
            type: "completed",
            workflow,
            runId,
            timestamp,
            result: { bookings: 1 },
          })
          return runId
        }).pipe(Effect.provideService(Database, connection.db)),
      )
    const drain = (value: Fixture, id: string) =>
      run(
        Effect.gen(function* () {
          const current = yield* Ref.make(awaitableState())
          yield* Effect.forEach(
            Array.range(0, 80),
            () =>
              Effect.gen(function* () {
                if ((yield* Ref.get(current))?.state === "live_data_deleted") {
                  return
                }
                const result = yield* Effect.promise(() =>
                  caller(value).dataLifecycle.resume({
                    projectId: value.projectId,
                    operationId: id,
                  }),
                )
                yield* Ref.set(current, result)
              }),
            { discard: true },
          )
          return yield* Ref.get(current)
        }),
      )
    const awaitableState = (): Awaited<
      ReturnType<ReturnType<typeof caller>["dataLifecycle"]["resume"]>
    > | null => null
    const confirm = (value: Fixture, id: string) =>
      caller(value).dataLifecycle.confirm({
        projectId: value.projectId,
        operationId: id,
        confirmation: "Booking setup",
        password: value.password,
      })
    beforeAll(() => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
    })
    afterAll(async () => {
      await connection.close()
      vi.unstubAllEnvs()
    })

    it("requires session ownership, a trusted origin, and fresh provider password verification", async () => {
      const value = await fixture()
      await expect(
        caller(value, "https://untrusted.example").dataLifecycle.preview({
          projectId: value.projectId,
          scope: { kind: "project" },
        }),
      ).rejects.toThrow("trusted Studio")
      await expect(
        caller(value).dataLifecycle.preview({
          projectId: value.foreignProjectId,
          scope: { kind: "project" },
        }),
      ).rejects.toThrow("Sign in")
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: { kind: "project" },
      })
      await expect(
        caller(value).dataLifecycle.confirm({
          projectId: value.projectId,
          operationId: preview.id,
          confirmation: "Booking setup",
          password: "wrong password",
        }),
      ).rejects.toThrow("Sign in")
      const [project] = await connection.db
        .select()
        .from(projects)
        .where(eq(projects.id, value.projectId))
      expect(project.lifecycleOperationId).toBeNull()
      expect(project.credentialEpoch).toBe(0)
    })

    it("erases complete selected evidence, fences reads/writes and requires fresh keys", async () => {
      const value = await fixture()
      await send(value.projectId)
      await send(value.projectId, randomUUID(), "keep.test")
      await send(value.foreignProjectId)
      await connection.db.insert(projectBrowserKeys).values({
        projectId: value.projectId,
        keyHash: hashApiKey(randomUUID()),
        allowedOrigins: ["http://localhost:3001"],
      })
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: {
          kind: "workflow",
          workflow: "erasure.test",
          after: "2000-01-01T00:00:00Z",
          before: "2100-01-01T00:00:00Z",
        },
      })
      expect(preview.counts.runs).toBe(1)
      expect(preview.counts.events).toBe(2)
      await confirm(value, preview.id)
      await expect(caller(value).project.snapshot()).rejects.toThrow()
      await expect(
        caller(value).project.createWriteKey({
          projectId: value.projectId,
          name: "racing key",
        }),
      ).rejects.toThrow()
      await expect(send(value.projectId)).rejects.toThrow()
      const done = await drain(value, preview.id)
      expect(done?.state).toBe("live_data_deleted")
      expect(done?.deletedRuns).toBe(1)
      expect(done?.deletedEvents).toBe(2)
      expect(done?.scope.kind).toBe("workflow")
      const remaining = await connection.db
        .select({ workflow: workflows.name })
        .from(workflowRuns)
        .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
        .where(eq(workflows.projectId, value.projectId))
      expect(remaining.map((row) => row.workflow)).toEqual(["keep.test"])
      expect(
        await connection.db
          .select()
          .from(projectApiKeys)
          .where(eq(projectApiKeys.projectId, value.projectId)),
      ).toHaveLength(0)
      expect(
        await connection.db
          .select()
          .from(projectBrowserKeys)
          .where(eq(projectBrowserKeys.projectId, value.projectId)),
      ).toHaveLength(0)
      await expect(send(value.projectId)).rejects.toThrow()
      const key = await caller(value).project.createWriteKey({
        projectId: value.projectId,
        name: "fresh",
      })
      const write = await run(
        WorkflowStore.make.pipe(Effect.provideService(Database, connection.db)),
      )
      await run(
        write.append(
          value.projectId,
          randomUUID(),
          {
            type: "started",
            workflow: "future.test",
            runId: randomUUID(),
            timestamp: new Date(Date.now() + 10).toISOString(),
          },
          { kind: "api", keyHash: hashApiKey(key.secret) },
        ),
      )
      const [foreign] = await connection.db
        .select({ count: sql<number>`count(*)::int` })
        .from(workflowRuns)
        .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
        .where(eq(workflows.projectId, value.foreignProjectId))
      expect(foreign.count).toBe(1)
    })

    it("rejects stale previews and unexpected multiple owners without revoking keys", async () => {
      const value = await fixture()
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: { kind: "project" },
      })
      await send(value.projectId)
      await expect(confirm(value, preview.id)).rejects.toThrow(
        "preview expired or changed",
      )
      const [foreignMember] = await connection.db
        .select()
        .from(projectMembers)
        .where(eq(projectMembers.projectId, value.foreignProjectId))
      await connection.db.insert(projectMembers).values({
        userId: foreignMember.userId,
        projectId: value.projectId,
        role: "owner",
      })
      await expect(
        caller(value).dataLifecycle.preview({
          projectId: value.projectId,
          scope: { kind: "project" },
        }),
      ).rejects.toThrow("shared projects")
      const [project] = await connection.db
        .select()
        .from(projects)
        .where(eq(projects.id, value.projectId))
      expect(project.credentialEpoch).toBe(0)
    })

    it("deletes a project, preserves foreign resources and returns idempotent completion", async () => {
      const value = await fixture()
      await send(value.projectId)
      const richRun = randomUUID()
      await run(
        Effect.gen(function* () {
          const writer = yield* WorkflowStore.make
          const base = {
            workflow: "booking.rich",
            runId: richRun,
            timestamp: new Date().toISOString(),
          }
          yield* writer.append(value.projectId, randomUUID(), {
            ...base,
            type: "started",
          })
          yield* writer.append(value.projectId, randomUUID(), {
            ...base,
            type: "expectation_declared",
            expectationId: "reply",
            name: "Provider reply",
            withinMs: 1000,
          })
          yield* writer.append(value.projectId, randomUUID(), {
            ...base,
            type: "expectation_resolved",
            expectationId: "reply",
            outcome: "accepted",
          })
          yield* writer.append(value.projectId, randomUUID(), {
            ...base,
            type: "failed",
            reason: "synthetic failure",
          })
        }).pipe(Effect.provideService(Database, connection.db)),
      )
      const ownedRuns = await connection.db
        .select({ id: workflowRuns.id })
        .from(workflowRuns)
        .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
        .where(eq(workflows.projectId, value.projectId))
      await connection.db
        .insert(workflowResultDeclarations)
        .values({
          projectId: value.projectId,
          workflow: "booking.rich",
          revision: "v1",
          declaration: { revision: "v1", fields: [] },
        })
      await connection.db
        .insert(workflowSearchFields)
        .values({
          projectId: value.projectId,
          workflow: "booking.rich",
          fields: [],
        })
      await connection.db
        .insert(workflowDefinitionImports)
        .values({
          projectId: value.projectId,
          actorId: value.userId,
          workflow: "booking.rich",
          source: "synthetic",
          manifestFingerprint: "synthetic-manifest",
          baseFingerprint: "synthetic-base",
          addedSearchKeys: [],
        })
      await connection.db
        .insert(savedInvestigations)
        .values({
          projectId: value.projectId,
          ownerId: value.userId,
          title: "Synthetic selection",
          selection: {
            version: 1,
            kind: "run",
            projectId: value.projectId,
            runId: ownedRuns[0].id,
            section: "events",
            limit: 7,
          },
        })
      await connection.db
        .insert(agentAccessGrantProjects)
        .values({
          projectId: value.projectId,
          authorizationCodeId: randomUUID(),
        })
      await connection.db
        .insert(projectBrowserKeys)
        .values({
          projectId: value.projectId,
          keyHash: hashApiKey(randomUUID()),
          allowedOrigins: ["http://localhost:3001"],
        })
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: { kind: "project" },
      })
      await confirm(value, preview.id)
      const done = await drain(value, preview.id)
      expect(done?.state).toBe("live_data_deleted")
      expect(
        await connection.db
          .select()
          .from(projects)
          .where(eq(projects.id, value.projectId)),
      ).toHaveLength(0)
      expect(
        await connection.db
          .select()
          .from(projects)
          .where(eq(projects.id, value.foreignProjectId)),
      ).toHaveLength(1)
      expect(
        (
          await caller(value).dataLifecycle.resume({
            projectId: value.projectId,
            operationId: preview.id,
          })
        ).state,
      ).toBe("live_data_deleted")
      expect(await caller(value).project.list()).toEqual([])
      const tables = [
        "workflow_events",
        "workflow_runs",
        "workflows",
        "project_api_keys",
        "project_browser_keys",
        "project_members",
        "workflow_result_declarations",
        "workflow_search_fields",
        "workflow_definition_imports",
        "saved_investigations",
        "agent_access_grant_projects",
      ] as const
      const counts = await run(
        Effect.forEach(tables, (table) =>
          Effect.promise(() =>
            connection.db.execute<{ count: number }>(
              table === "workflow_events"
                ? sql`SELECT count(*)::int AS count FROM workflow_events WHERE run_id IN (SELECT jsonb_array_elements_text(${JSON.stringify(Array.map(ownedRuns, (row) => row.id))}::jsonb)::uuid)`
                : table === "workflow_runs"
                  ? sql`SELECT count(*)::int AS count FROM workflow_runs WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(Array.map(ownedRuns, (row) => row.id))}::jsonb)::uuid)`
                  : table === "workflows"
                    ? sql`SELECT count(*)::int AS count FROM workflows WHERE project_id = ${value.projectId}::uuid`
                    : sql`SELECT count(*)::int AS count FROM ${sql.identifier(table)} WHERE project_id = ${value.projectId}::uuid`,
            ),
          ).pipe(Effect.map((rows) => rows[0].count)),
        ),
      )
      expect(counts).toEqual(Array.replicate(0, tables.length))
      const derived = await run(
        Effect.forEach(
          [workflowExpectations, workflowRunFacts, workflowMetricFacts],
          (table) =>
            Effect.promise(() =>
              connection.db
                .select({ count: sql<number>`count(*)::int` })
                .from(table)
                .where(
                  sql`${table.runId} IN (SELECT jsonb_array_elements_text(${JSON.stringify(Array.map(ownedRuns, (row) => row.id))}::jsonb)::uuid)`,
                ),
            ).pipe(Effect.map((rows) => rows[0].count)),
        ),
      )
      expect(derived).toEqual([0, 0, 0])
    })

    it("rejects a request authenticated before erasure even after the project reopens", async () => {
      const value = await fixture()
      const ready = await run(Deferred.make<void>())
      const release = await run(Deferred.make<void>())
      const pending = runApi(
        Effect.flatMap(IngestWorkflowEvents, (ingest) =>
          ingest.ingest(
            `Bearer ${value.writeKey}`,
            Effect.gen(function* () {
              yield* Deferred.succeed(ready, undefined)
              yield* Deferred.await(release)
              return {
                eventId: randomUUID(),
                event: {
                  type: "started",
                  workflow: "delayed.test",
                  runId: randomUUID(),
                  timestamp: new Date(Date.now() + 1000).toISOString(),
                },
              }
            }),
          ),
        ),
      )
      await run(Deferred.await(ready))
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: {
          kind: "workflow",
          workflow: "delayed.test",
          after: "2000-01-01T00:00:00Z",
          before: "2100-01-01T00:00:00Z",
        },
      })
      await confirm(value, preview.id)
      await drain(value, preview.id)
      await run(Deferred.succeed(release, undefined))
      expect(Exit.isFailure(await pending)).toBe(true)
      expect(
        await connection.db
          .select()
          .from(workflows)
          .where(
            and(
              eq(workflows.projectId, value.projectId),
              eq(workflows.name, "delayed.test"),
            ),
          ),
      ).toHaveLength(0)
    })

    it("bounds a large run batch, preserves progress, and resumes after closing a client", async () => {
      const value = await fixture()
      await send(value.projectId)
      const [target] = await connection.db
        .select({ id: workflowRuns.id })
        .from(workflowRuns)
        .innerJoin(workflows, eq(workflows.id, workflowRuns.workflowId))
        .where(eq(workflows.projectId, value.projectId))
      await connection.db.insert(workflowEvents).values(
        Array.map(Array.range(1, 1005), () => ({
          eventId: randomUUID(),
          runId: target.id,
          type: "step" as const,
          occurredAt: new Date(),
          step: "synthetic",
        })),
      )
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: { kind: "runs", runIds: [target.id] },
      })
      await confirm(value, preview.id)
      const persistence = await store()
      await run(persistence.resume(value.userId, value.projectId, preview.id)) // cyclic references
      await run(persistence.resume(value.userId, value.projectId, preview.id)) // expectations
      const first = await run(
        persistence.resume(value.userId, value.projectId, preview.id),
      )
      expect(first.deletedEvents).toBe(1000)
      expect(first.state).toBe("purging")
      expect(
        (
          await caller(value).dataLifecycle.status({
            projectId: value.projectId,
          })
        )?.deletedEvents,
      ).toBe(1000)
      const done = await drain(value, preview.id)
      expect(done?.deletedEvents).toBe(1007)
      expect(done?.state).toBe("live_data_deleted")
    })

    it("rolls back a blocked batch, records failure and resumes without reopening access", async () => {
      const value = await fixture()
      await send(value.projectId)
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: { kind: "project" },
      })
      await confirm(value, preview.id)
      const persistence = await store()
      await run(persistence.resume(value.userId, value.projectId, preview.id))
      await run(persistence.resume(value.userId, value.projectId, preview.id))
      const locked = await run(Deferred.make<void>())
      const release = await run(Deferred.make<void>())
      const blocker = connection.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT e.id FROM workflow_events e JOIN workflow_runs r ON r.id = e.run_id JOIN workflows w ON w.id = r.workflow_id WHERE w.project_id = ${value.projectId}::uuid FOR UPDATE OF e`,
        )
        await run(Deferred.succeed(locked, undefined))
        await run(Deferred.await(release))
      })
      try {
        await run(Deferred.await(locked))
        await expect(
          caller(value).dataLifecycle.resume({
            projectId: value.projectId,
            operationId: preview.id,
          }),
        ).rejects.toThrow()
        const failed = await caller(value).dataLifecycle.status({
          projectId: value.projectId,
        })
        expect(failed?.failureCode).toBe("BatchFailed")
        expect(failed?.deletedEvents).toBe(0)
        expect(failed?.state).toBe("purging")
        await expect(send(value.projectId)).rejects.toThrow()
      } finally {
        await run(Deferred.succeed(release, undefined))
        await blocker
      }
      expect((await drain(value, preview.id))?.state).toBe("live_data_deleted")
    }, 15000)

    it("cancels only unused previews and rejects forged or expired selections", async () => {
      const value = await fixture()
      const preview = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: { kind: "project" },
      })
      await expect(
        caller(value).dataLifecycle.cancel({
          projectId: value.foreignProjectId,
          operationId: preview.id,
        }),
      ).rejects.toThrow()
      expect(
        (
          await caller(value).dataLifecycle.cancel({
            projectId: value.projectId,
            operationId: preview.id,
          })
        ).state,
      ).toBe("cancelled")
      await expect(confirm(value, preview.id)).rejects.toThrow(
        "preview expired or changed",
      )
      const [project] = await connection.db
        .select()
        .from(projects)
        .where(eq(projects.id, value.projectId))
      expect(project.credentialEpoch).toBe(0)
      const next = await caller(value).dataLifecycle.preview({
        projectId: value.projectId,
        scope: { kind: "project" },
      })
      await confirm(value, next.id)
      await expect(
        caller(value).dataLifecycle.cancel({
          projectId: value.projectId,
          operationId: next.id,
        }),
      ).rejects.toThrow()
      expect((await drain(value, next.id))?.state).toBe("live_data_deleted")
    })
  },
)
