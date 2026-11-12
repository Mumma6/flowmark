import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import { and, eq, sql } from "drizzle-orm"
import { Array, Effect, Order } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import {
  createDatabase,
  projectMembers,
  workflowDefinitionImports,
  workflowResultDeclarations,
  workflowSearchFields,
} from "@flowmark/db"
import { Database, ResultDeclarationStore } from "@flowmark/db/persistence"
import { POST } from "../../app/api/trpc/[trpc]/route"
import { appRouter } from "../../src/adapters/trpc/router"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "reviewed definition imports",
  () => {
    let connection: ReturnType<typeof createDatabase>
    let fixture: Effect.Success<
      ReturnType<typeof createDefinitionImportFixture>
    >
    const owner = () =>
      appRouter.createCaller({
        request: new Request("http://localhost:3001/api/trpc", {
          headers: {
            cookie: fixture.cookie,
            "x-flowmark-project-id": fixture.projectId,
          },
        }),
      })
    const definition = (workflow = `booking.${randomUUID()}`) => ({
      version: 1 as const,
      source: "booking-app",
      workflow,
      result: {
        revision: "v1",
        fields: [
          {
            path: ["submitted"],
            label: "Submitted bookings",
            kind: "count" as const,
          },
        ],
      },
      searchFields: [{ key: "bookingRef", role: "lookup" as const }],
    })
    const reviewed = async (input = definition()) => {
      const preview = await owner().resultDeclarations.previewImport({
        projectId: fixture.projectId,
        definition: input,
      })
      return {
        definition: input,
        manifestFingerprint: preview.manifestFingerprint,
        baseFingerprint: preview.baseFingerprint,
      }
    }
    const rows = (workflow: string) =>
      Promise.all([
        connection.db
          .select()
          .from(workflowResultDeclarations)
          .where(
            and(
              eq(workflowResultDeclarations.projectId, fixture.projectId),
              eq(workflowResultDeclarations.workflow, workflow),
            ),
          ),
        connection.db
          .select()
          .from(workflowSearchFields)
          .where(
            and(
              eq(workflowSearchFields.projectId, fixture.projectId),
              eq(workflowSearchFields.workflow, workflow),
            ),
          ),
        connection.db
          .select()
          .from(workflowDefinitionImports)
          .where(
            and(
              eq(workflowDefinitionImports.projectId, fixture.projectId),
              eq(workflowDefinitionImports.workflow, workflow),
            ),
          ),
      ])
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      fixture = await Effect.runPromise(
        createDefinitionImportFixture(connection.db),
      )
    })
    afterAll(async () => {
      await connection?.close()
      vi.unstubAllEnvs()
    })

    it("applies once under concurrent retries and exposes the same meaning through scoped discovery", async () => {
      const command = await reviewed()
      const input = { projectId: fixture.projectId, command }
      const responses = await Promise.all([
        owner().resultDeclarations.applyImport(input),
        owner().resultDeclarations.applyImport(input),
      ])
      expect(
        Array.sort(
          responses.map((value) => value.status),
          Order.String,
        ),
      ).toEqual(["AlreadyApplied", "Applied"])
      expect(responses[0]?.receiptId).toBe(responses[1]?.receiptId)
      const [results, search, receipts] = await rows(
        command.definition.workflow,
      )
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        source: "booking-app",
        declaration: command.definition.result,
      })
      expect(search[0]).toMatchObject({
        fields: command.definition.searchFields,
        sources: { bookingRef: "booking-app" },
      })
      expect(receipts).toHaveLength(1)
      const meaning = await owner().workflow.meaning({
        workflow: command.definition.workflow,
        limit: 1,
      })
      expect(meaning.revisions[0]).toMatchObject({
        source: "booking-app",
        declaration: command.definition.result,
      })
      expect(meaning.searchSources).toEqual({ bookingRef: "booking-app" })
      expect(meaning.lookupKeys).toEqual(["bookingRef"])
      expect(
        (await owner().workflow.discover({ limit: 100 })).workflows,
      ).toContainEqual({ name: command.definition.workflow })
      await expect(
        owner().resultDeclarations.applyImport({
          ...input,
          command: {
            ...command,
            definition: {
              ...command.definition,
              result: { ...command.definition.result, fields: [] },
            },
          },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    })

    it("rejects stale review and same-revision conflicts without partial writes", async () => {
      const command = await reviewed()
      const scope = {
        projectId: fixture.projectId,
        workflow: command.definition.workflow,
      }
      await owner().resultDeclarations.setSearchFields({
        ...scope,
        fields: [{ key: "region", role: "lookup" }],
      })
      await expect(
        owner().resultDeclarations.applyImport({
          projectId: fixture.projectId,
          command,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const refreshed = await reviewed(command.definition)
      await owner().resultDeclarations.applyImport({
        projectId: fixture.projectId,
        command: refreshed,
      })
      const conflicting = {
        ...command.definition,
        result: { ...command.definition.result, fields: [] },
      }
      const preview = await owner().resultDeclarations.previewImport({
        projectId: fixture.projectId,
        definition: conflicting,
      })
      expect(preview.status).toBe("Conflict")
      await expect(
        owner().resultDeclarations.applyImport({
          projectId: fixture.projectId,
          command: {
            definition: conflicting,
            manifestFingerprint: preview.manifestFingerprint,
            baseFingerprint: preview.baseFingerprint,
          },
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      const [results, fields, receipts] = await rows(scope.workflow)
      expect(results[0]?.declaration).toEqual(command.definition.result)
      expect(fields[0]?.fields).toEqual([
        { key: "region", role: "lookup" },
        ...command.definition.searchFields,
      ])
      expect(receipts).toHaveLength(1)
    })

    it("preserves Studio ownership on no-op imports and protects code fields from replacement", async () => {
      const first = definition()
      const scope = { projectId: fixture.projectId, workflow: first.workflow }
      await owner().resultDeclarations.create({
        ...scope,
        declaration: first.result,
      })
      await owner().resultDeclarations.setSearchFields({
        ...scope,
        fields: first.searchFields,
      })
      const command = await reviewed(first)
      expect(
        (
          await owner().resultDeclarations.applyImport({
            projectId: fixture.projectId,
            command,
          })
        ).status,
      ).toBe("Unchanged")
      expect((await rows(first.workflow))[0][0]?.source).toBeNull()
      expect((await rows(first.workflow))[1][0]?.sources).toEqual({})
      const next = {
        ...first,
        result: { ...first.result, revision: "v2" },
        searchFields: [
          ...first.searchFields,
          { key: "confirmationRef", role: "lookup" as const },
        ],
      }
      await owner().resultDeclarations.applyImport({
        projectId: fixture.projectId,
        command: await reviewed(next),
      })
      await expect(
        owner().resultDeclarations.setSearchFields({
          ...scope,
          fields: first.searchFields,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      await expect(
        owner().resultDeclarations.setSearchFields({
          ...scope,
          fields: [
            ...first.searchFields,
            { key: "confirmationRef", role: "dimension", values: ["yes"] },
          ],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" })
      // Studio-owned fields remain editable when the code-owned field is preserved.
      await owner().resultDeclarations.setSearchFields({
        ...scope,
        fields: [
          { key: "bookingRef", role: "dimension", values: ["demo"] },
          next.searchFields[1]!,
        ],
      })
      const actual = await owner().workflow.meaning({
        workflow: first.workflow,
      })
      expect(actual.searchSources).toEqual({ confirmationRef: "booking-app" })
      expect(
        actual.revisions.map((value) => ({
          revision: value.revision,
          source: value.source,
        })),
      ).toEqual([
        { revision: "v1", source: null },
        { revision: "v2", source: "booking-app" },
      ])
    })

    it("denies foreign projects and all non-session credentials at the apply boundary", async () => {
      const command = await reviewed()
      await expect(
        owner().resultDeclarations.applyImport({
          projectId: fixture.foreignProjectId,
          command,
        }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
      await Effect.runPromise(
        Effect.forEach([fixture.readKey, fixture.writeKey], (key) =>
          Effect.promise(async () => {
            const response = await POST(
              new Request(
                "http://localhost:3001/api/trpc/resultDeclarations.applyImport",
                {
                  method: "POST",
                  headers: {
                    authorization: `Bearer ${key}`,
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({
                    projectId: fixture.projectId,
                    command,
                  }),
                },
              ),
            )
            expect(response.status).toBe(401)
          }),
        ),
      )
      expect((await rows(command.definition.workflow))[2]).toEqual([])
    })

    it("rechecks membership inside the transaction even after an earlier authorized preview", async () => {
      const command = await reviewed()
      const store = await Effect.runPromise(
        ResultDeclarationStore.make.pipe(
          Effect.provideService(Database, connection.db),
        ),
      )
      await connection.db
        .delete(projectMembers)
        .where(
          and(
            eq(projectMembers.userId, fixture.userId),
            eq(projectMembers.projectId, fixture.projectId),
          ),
        )
      try {
        await expect(
          Effect.runPromise(
            store.apply(fixture.userId, fixture.projectId, command),
          ),
        ).rejects.toMatchObject({
          _tag: "DefinitionImportRejected",
          reason: "Unauthorized",
        })
      } finally {
        await connection.db.insert(projectMembers).values({
          userId: fixture.userId,
          projectId: fixture.projectId,
          role: "owner",
        })
      }
      expect((await rows(command.definition.workflow))[0]).toEqual([])
    })

    it("rolls back both metadata and provenance if recording the receipt fails", async () => {
      const command = await reviewed()
      const name = `reject_import_${randomUUID().replaceAll("-", "")}`
      const identifier = sql.identifier(name)
      await connection.db.execute(
        sql`CREATE FUNCTION ${identifier}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic receipt failure'; END; $$`,
      )
      await connection.db.execute(
        sql`CREATE TRIGGER ${identifier} BEFORE INSERT ON workflow_definition_imports FOR EACH ROW WHEN (NEW.project_id = ${sql.raw(`'${fixture.projectId}'::uuid`)} AND NEW.workflow = ${sql.raw(`'${command.definition.workflow}'`)}) EXECUTE FUNCTION ${identifier}()`,
      )
      try {
        await expect(
          owner().resultDeclarations.applyImport({
            projectId: fixture.projectId,
            command,
          }),
        ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
        expect(await rows(command.definition.workflow)).toEqual([[], [], []])
      } finally {
        await connection.db.execute(
          sql`DROP TRIGGER ${identifier} ON workflow_definition_imports`,
        )
        await connection.db.execute(sql`DROP FUNCTION ${identifier}()`)
      }
      expect(
        (
          await owner().resultDeclarations.applyImport({
            projectId: fixture.projectId,
            command,
          })
        ).status,
      ).toBe("Applied")
    })

    it("upgrades populated legacy declarations without changing meaning or adopting ownership", async () => {
      const name = `definition_upgrade_${randomUUID().replaceAll("-", "")}`
      const schema = sql.identifier(name)
      const migration = readFileSync(
        new URL(
          "../../../../packages/db/migrations/0022_code_owned_definitions.sql",
          import.meta.url,
        ),
        "utf8",
      )
      await connection.db.transaction(async (tx) => {
        await tx.execute(sql`CREATE SCHEMA ${schema}`)
        await tx.execute(sql`SET LOCAL search_path TO ${schema}, public`)
        // Keep upgrade DDL off the live auth/project parents used by parallel tests.
        await tx.execute(sql`CREATE TABLE "user" (id text PRIMARY KEY)`)
        await tx.execute(sql`CREATE TABLE projects (id uuid PRIMARY KEY)`)
        await tx.execute(
          sql`INSERT INTO projects VALUES (${fixture.projectId}::uuid)`,
        )

        await tx.execute(
          sql`CREATE TABLE workflow_result_declarations (LIKE public.workflow_result_declarations INCLUDING ALL)`,
        )
        await tx.execute(
          sql`CREATE TABLE workflow_search_fields (LIKE public.workflow_search_fields INCLUDING ALL)`,
        )
        await tx.execute(
          sql`ALTER TABLE workflow_result_declarations DROP COLUMN source`,
        )
        await tx.execute(
          sql`ALTER TABLE workflow_search_fields DROP COLUMN sources`,
        )
        const legacy = definition("legacy.booking")
        await tx.execute(
          sql`INSERT INTO workflow_result_declarations (project_id, workflow, revision, declaration) VALUES (${fixture.projectId}::uuid, ${legacy.workflow}, 'v1', ${JSON.stringify(legacy.result)}::jsonb)`,
        )
        await tx.execute(
          sql`INSERT INTO workflow_search_fields (project_id, workflow, fields) VALUES (${fixture.projectId}::uuid, ${legacy.workflow}, ${JSON.stringify(legacy.searchFields)}::jsonb)`,
        )
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
        const results = await tx.execute<{
          declaration: unknown
          source: string | null
        }>(sql`SELECT declaration, source FROM workflow_result_declarations`)
        const fields = await tx.execute<{ fields: unknown; sources: unknown }>(
          sql`SELECT fields, sources FROM workflow_search_fields`,
        )
        expect(results[0]).toEqual({ declaration: legacy.result, source: null })
        expect(fields[0]).toEqual({ fields: legacy.searchFields, sources: {} })
        await tx.execute(sql`DROP SCHEMA ${schema} CASCADE`)
      })
    })
  },
)
