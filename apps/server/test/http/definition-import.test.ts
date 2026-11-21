import { randomUUID } from "node:crypto"
import { Array, Effect, Option } from "effect"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { createDatabase } from "@flowmark/db"
import { POST as trpc } from "../../app/api/trpc/[trpc]/route"
import { POST as ingest } from "../../app/v1/events/route"
import { appRouter } from "../../src/adapters/trpc/router"
import { createDefinitionImportFixture } from "./support/definition-import-fixture"

const definition = {
  version: 1,
  source: "booking-app",
  workflow: "booking.create",
  result: {
    revision: "booking-v1",
    fields: [
      {
        path: ["submitted"],
        label: "Submitted bookings",
        kind: "count" as const,
      },
    ],
  },
  searchFields: [{ key: "bookingRef", role: "lookup" as const }],
}

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "definition import HTTP dry run",
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
    const preview = (
      input: unknown = definition,
      headers: HeadersInit = { cookie: fixture.cookie },
      projectId = fixture.projectId,
    ) =>
      trpc(
        new Request(
          "http://localhost:3001/api/trpc/resultDeclarations.previewImport",
          {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify({ projectId, definition: input }),
          },
        ),
      )
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

    it("previews the real booking metadata without persisting either declaration", async () => {
      const response = await preview()
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        result: {
          data: {
            projectId: fixture.projectId,
            status: "Reviewable",
            result: { action: "Create" },
            searchFields: { additions: definition.searchFields },
          },
        },
      })
      expect(
        await owner().resultDeclarations.list({
          projectId: fixture.projectId,
          workflow: definition.workflow,
        }),
      ).toEqual([])
      expect(
        await owner().resultDeclarations.searchFields({
          projectId: fixture.projectId,
          workflow: definition.workflow,
        }),
      ).toEqual([])
    })

    it("isolates projects, rejects API keys and validates nested metadata", async () => {
      expect(
        (
          await preview(
            definition,
            { cookie: fixture.cookie },
            fixture.foreignProjectId,
          )
        ).status,
      ).toBe(401)
      await Effect.runPromise(
        Effect.forEach([fixture.readKey, fixture.writeKey], (key) =>
          Effect.promise(async () => {
            expect(
              (await preview(definition, { authorization: `Bearer ${key}` }))
                .status,
            ).toBe(401)
          }),
        ),
      )
      expect((await preview(definition, {})).status).toBe(401)
      expect(
        (
          await preview({
            ...definition,
            result: { ...definition.result, overwrite: true },
          })
        ).status,
      ).toBe(400)
    })

    it("reports immutable conflicts and preserves historical evidence and omitted Studio permissions", async () => {
      const api = owner()
      const scope = {
        projectId: fixture.projectId,
        workflow: definition.workflow,
      }
      await api.resultDeclarations.create({
        ...scope,
        declaration: definition.result,
      })
      const studioFields = [
        { key: "region", role: "dimension" as const, values: ["north"] },
      ]
      await api.resultDeclarations.setSearchFields({
        ...scope,
        fields: studioFields,
      })
      const runId = randomUUID()
      const started = {
        type: "started",
        workflow: definition.workflow,
        runId,
        timestamp: new Date().toISOString(),
        properties: {
          definitionRevision: "booking-v1",
          bookingRef: "synthetic-history",
        },
      }
      expect(
        (
          await ingest(
            new Request("http://localhost:3001/v1/events", {
              method: "POST",
              headers: {
                authorization: `Bearer ${fixture.writeKey}`,
                "content-type": "application/json",
              },
              body: JSON.stringify({ eventId: randomUUID(), event: started }),
            }),
          )
        ).status,
      ).toBe(202)
      const listed = await api.run.list({
        workflow: definition.workflow,
        externalId: runId,
      })
      expect(listed.runs).toHaveLength(1)
      const storedRun = Array.head(listed.runs).pipe(Option.getOrThrow)
      const before = await api.run.detail({ id: storedRun.id })
      const same = await api.resultDeclarations.previewImport({
        projectId: fixture.projectId,
        definition,
      })
      expect(same.result.action).toBe("Unchanged")
      expect(same.searchFields.proposed).toEqual([
        ...studioFields,
        ...definition.searchFields,
      ])
      const conflict = await api.resultDeclarations.previewImport({
        projectId: fixture.projectId,
        definition: {
          ...definition,
          result: { ...definition.result, fields: [] },
          searchFields: [{ key: "region", role: "lookup" }],
        },
      })
      expect(conflict.status).toBe("Conflict")
      expect(conflict.result.action).toBe("Conflict")
      expect(conflict.searchFields.proposed).toBeNull()
      expect(await api.resultDeclarations.list(scope)).toEqual([
        definition.result,
      ])
      expect(await api.resultDeclarations.searchFields(scope)).toEqual(
        studioFields,
      )
      expect(await api.run.detail({ id: storedRun.id })).toEqual(before)
      expect(before[0]).toMatchObject({ properties: started.properties })
    })
    it("reviews a composed rename, serializes competing changes and preserves the original interpretation", async () => {
      const api = owner()
      const projectId = fixture.projectId
      const oldWorkflow = "reservation.submit"
      const renamed = "reservation.request"
      const runId = randomUUID()
      const send = async (workflow: string, id: string) => {
        const response = await ingest(
          new Request("http://localhost:3001/v1/events", {
            method: "POST",
            headers: {
              authorization: `Bearer ${fixture.writeKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              eventId: randomUUID(),
              event: {
                type: "started",
                workflow,
                runId: id,
                timestamp: new Date().toISOString(),
              },
            }),
          }),
        )
        expect(response.status).toBe(202)
      }
      await send(oldWorkflow, runId)
      await send("reservation.confirm", randomUUID())
      await send("reservation.verify", randomUUID())
      const page = await api.run.list({
        workflow: oldWorkflow,
        externalId: runId,
      })
      const original = { id: Array.head(page.runs).pipe(Option.getOrThrow).id }
      const before = await api.run.detail(original)
      const first = {
        version: 1,
        source: "booking-app",
        workflow: oldWorkflow,
        process: {
          key: "reservation",
          revision: 1,
          members: [
            { role: "request", workflows: [oldWorkflow] },
            {
              role: "confirmation",
              workflows: ["reservation.confirm", "reservation.verify"],
            },
            { role: "delivery", workflows: ["reservation.deliver"] },
          ],
        },
      }
      const review = (input: typeof first) =>
        api.resultDeclarations.previewImport({ projectId, definition: input })
      const command = async (input: typeof first) => {
        const preview = await review(input)
        return {
          definition: input,
          manifestFingerprint: preview.manifestFingerprint,
          baseFingerprint: preview.baseFingerprint,
        }
      }
      const apply = (input: Awaited<ReturnType<typeof command>>) =>
        api.resultDeclarations.applyImport({ projectId, command: input })
      expect((await review(first)).process?.proposed.matches).toMatchObject([
        { status: "Matched", observed: [oldWorkflow] },
        {
          status: "Ambiguous",
          observed: ["reservation.confirm", "reservation.verify"],
        },
        { status: "Excluded", missing: ["reservation.deliver"] },
      ])
      const firstCommand = await command(first)
      const accepted = await apply(firstCommand)
      expect(accepted).toMatchObject({ status: "Applied", processRevision: 1 })
      await send(renamed, randomUUID())
      const proposed = {
        ...first,
        workflow: renamed,
        process: {
          ...first.process,
          revision: 2,
          members: [
            { role: "request", workflows: [renamed] },
            { role: "confirmation", workflows: ["reservation.confirm"] },
          ],
        },
      }
      const alternative = {
        ...proposed,
        workflow: oldWorkflow,
        process: {
          ...proposed.process,
          members: [{ role: "request", workflows: [renamed] }],
        },
      }
      const [next, competing] = await Promise.all([
        command(proposed),
        command(alternative),
      ])
      const outcomes = await Promise.allSettled([apply(next), apply(competing)])
      expect(outcomes.map((outcome) => outcome.status).sort()).toEqual([
        "fulfilled",
        "rejected",
      ])
      const historical = await review(first)
      expect(historical).toMatchObject({
        status: "Conflict",
        process: {
          previous: { definition: { revision: 2 } },
          requestedRevision: { definition: { revision: 1 } },
        },
      })
      expect(historical.process?.previous?.matches[0]?.observed).toEqual([
        renamed,
      ])
      expect(
        historical.process?.requestedRevision?.matches[0]?.observed,
      ).toEqual([oldWorkflow])
      expect(await apply(firstCommand)).toMatchObject({
        status: "AlreadyApplied",
        receiptId: accepted.receiptId,
      })
      expect(await api.run.detail(original)).toEqual(before)
      expect(
        (
          await review({
            ...proposed,
            source: "other-app",
            process: { ...proposed.process, revision: 3 },
          })
        ).status,
      ).toBe("Conflict")
    })
  },
)
