import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { Effect, Result } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database, InvalidResultQuery } from "../../src/persistence/database.js"
import { getResultDeclarations } from "../../src/persistence/result-declarations/queries/get-result-declarations.js"
import { getSearchFields } from "../../src/persistence/result-declarations/queries/get-search-fields.js"
import { getWorkflowDiscoveryPage } from "../../src/persistence/workflows/queries/get-workflow-discovery-page.js"
import { getWorkflowMeaningPage } from "../../src/persistence/workflows/queries/get-workflow-meaning-page.js"
import {
  encodeRevisionDiscoveryCursor,
  encodeWorkflowDiscoveryCursor,
} from "../../src/persistence/workflows/workflow-discovery-cursor.js"

const url = process.env.TEST_DATABASE_URL

test(
  "workflow discovery pages stay inside the authorized project",
  { skip: !url },
  async () => {
    assert.ok(
      ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url!).hostname),
      "disposable loopback TEST_DATABASE_URL required",
    )
    const { db, close } = createDatabase(url!)
    const workspace = randomUUID()
    const project = randomUUID()
    const other = randomUUID()
    const alpha = randomUUID()
    const zebra = randomUUID()
    const secretWorkflow = randomUUID()
    const revA = randomUUID()
    const revB = randomUUID()
    const hugeId = randomUUID()
    const betaId = randomUUID()
    const foreignId = randomUUID()
    const declaration = (
      revision: string,
      extra?: Record<string, unknown>,
    ) => ({
      revision,
      fields: [{ path: ["saved"], label: "Saved", kind: "count" }],
      ...extra,
    })
    const alphaFields = [
      { key: "customerId", role: "lookup" },
      { key: "region", role: "dimension", values: ["eu"] },
    ]
    const run = <A, E>(effect: Effect.Effect<A, E, typeof db>) =>
      Effect.runPromise(
        Effect.result(effect).pipe(Effect.provideService(Database, db)),
      )
    try {
      await db.execute(
        sql`INSERT INTO workspaces(id, name) VALUES (${workspace}, 'discovery-test')`,
      )
      await db.execute(sql`
        INSERT INTO projects(id, workspace_id, name)
        VALUES (${project}, ${workspace}, 'discovery'), (${other}, ${workspace}, 'other')
      `)
      await db.execute(sql`
        INSERT INTO workflows(id, project_id, name) VALUES
          (${alpha}, ${project}, 'alpha'),
          (${zebra}, ${project}, 'zebra'),
          (${secretWorkflow}, ${other}, 'secret.workflow')
      `)
      await db.execute(sql`
        INSERT INTO workflow_result_declarations
          (id, project_id, workflow, revision, declaration, created_at)
        VALUES
          (${revA}, ${project}, 'alpha', 'rev-a', ${JSON.stringify(declaration("rev-a"))}::jsonb, '2026-01-01T00:00:00Z'),
          (${revB}, ${project}, 'alpha', 'rev-b', ${JSON.stringify(declaration("rev-b"))}::jsonb, '2026-01-02T00:00:00Z'),
          (${hugeId}, ${project}, 'alpha', 'huge', ${JSON.stringify(declaration("huge", { blob: "x".repeat(20_000) }))}::jsonb, '2026-01-03T00:00:00Z'),
          (${betaId}, ${project}, 'beta', 'beta-rev', ${JSON.stringify(declaration("beta-rev"))}::jsonb, '2026-01-01T00:00:00Z'),
          (${foreignId}, ${other}, 'secret.workflow', 'foreign-rev', ${JSON.stringify(declaration("foreign-rev"))}::jsonb, '2026-01-01T00:00:00Z')
      `)
      await db.execute(sql`
        INSERT INTO workflow_search_fields(project_id, workflow, fields) VALUES
          (${project}, 'alpha', ${JSON.stringify(alphaFields)}::jsonb),
          (${project}, 'gamma', ${JSON.stringify([{ key: "channel", role: "lookup" }])}::jsonb),
          (${other}, 'secret.workflow', ${JSON.stringify([{ key: "secretKey", role: "lookup" }])}::jsonb),
          (${other}, 'alpha', ${JSON.stringify([{ key: "secretKey", role: "lookup" }])}::jsonb)
      `)

      const first = await run(getWorkflowDiscoveryPage(project, { limit: 2 }))
      const firstPage = Result.getOrThrow(first)
      assert.deepEqual(
        firstPage.workflows.map((workflow) => workflow.name),
        ["alpha", "beta"],
      )
      assert.equal(firstPage.total, 4)
      assert.equal(firstPage.limit, 2)
      assert.equal(firstPage.applied.projectId, project)
      assert.equal(firstPage.omissions.continued, true)
      assert.deepEqual(firstPage.capabilities.mutations, [])
      assert.ok(firstPage.nextCursor)

      const second = Result.getOrThrow(
        await run(
          getWorkflowDiscoveryPage(project, {
            limit: 2,
            cursor: firstPage.nextCursor ?? undefined,
          }),
        ),
      )
      assert.deepEqual(
        second.workflows.map((workflow) => workflow.name),
        ["gamma", "zebra"],
      )
      assert.equal(second.nextCursor, null)
      assert.equal(JSON.stringify(second).includes("secret.workflow"), false)

      const foreignCursor = await run(
        getWorkflowDiscoveryPage(project, {
          cursor: encodeWorkflowDiscoveryCursor({
            projectId: other,
            name: "alpha",
          }),
        }),
      )
      Result.match(foreignCursor, {
        onFailure: (error) => {
          assert.ok(error instanceof InvalidResultQuery)
          assert.equal(error.message, "Invalid workflow discovery cursor.")
        },
        onSuccess: () => assert.fail("foreign cursor changed the page"),
      })

      const clamped = Result.getOrThrow(
        await run(getWorkflowDiscoveryPage(project, { limit: 500 })),
      )
      assert.equal(clamped.limit, 100)
      assert.equal(clamped.applied.limit, 100)
      const rejectedLimit = await run(
        getWorkflowDiscoveryPage(project, { limit: 1.5 }),
      )
      Result.match(rejectedLimit, {
        onFailure: (error) =>
          assert.equal(error.message, "Invalid workflow discovery limit."),
        onSuccess: () => assert.fail("fractional limit was accepted"),
      })

      const meaning = Result.getOrThrow(
        await run(
          getWorkflowMeaningPage(project, { workflow: "alpha", limit: 2 }),
        ),
      )
      assert.deepEqual(
        meaning.revisions.map((revision) => revision.revision),
        ["rev-a", "rev-b"],
      )
      assert.equal(meaning.totalRevisions, 3)
      assert.deepEqual(meaning.lookupKeys, ["customerId"])
      assert.deepEqual(meaning.dimensionKeys, ["region"])
      assert.deepEqual(meaning.searchFields, alphaFields)
      assert.equal(meaning.revisions[0]?.truncated, false)
      assert.equal(JSON.stringify(meaning).includes("secretKey"), false)

      const listed = Result.getOrThrow(
        await run(getResultDeclarations(project, "alpha")),
      )
      const configured = Result.getOrThrow(
        await run(getSearchFields(project, "alpha")),
      )
      assert.deepEqual(meaning.searchFields, configured)
      assert.deepEqual(meaning.revisions[0]?.declaration, listed[0])
      assert.deepEqual(meaning.revisions[1]?.declaration, listed[1])

      const rest = Result.getOrThrow(
        await run(
          getWorkflowMeaningPage(project, {
            workflow: "alpha",
            limit: 2,
            cursor: meaning.nextCursor ?? undefined,
          }),
        ),
      )
      assert.equal(rest.revisions[0]?.revision, "huge")
      assert.equal(rest.revisions[0]?.truncated, true)
      assert.equal(
        JSON.stringify(rest.revisions[0]?.declaration).includes("xxxxx"),
        false,
      )

      const switchedWorkflow = await run(
        getWorkflowMeaningPage(project, {
          workflow: "beta",
          cursor: meaning.nextCursor ?? undefined,
        }),
      )
      Result.match(switchedWorkflow, {
        onFailure: (error) =>
          assert.equal(error.message, "Invalid workflow discovery cursor."),
        onSuccess: () => assert.fail("cursor changed workflow scope"),
      })

      const foreignRevision = Result.getOrThrow(
        await run(
          getWorkflowMeaningPage(project, {
            workflow: "alpha",
            revision: "foreign-rev",
          }),
        ),
      )
      assert.deepEqual(foreignRevision.revisions, [])
      assert.equal(foreignRevision.totalRevisions, 0)
      assert.deepEqual(foreignRevision.lookupKeys, ["customerId"])
      assert.equal(foreignRevision.applied.projectId, project)
      assert.equal(foreignRevision.applied.revision, "foreign-rev")

      const otherWorkflow = Result.getOrThrow(
        await run(
          getWorkflowMeaningPage(project, { workflow: "secret.workflow" }),
        ),
      )
      assert.deepEqual(otherWorkflow.revisions, [])
      assert.deepEqual(otherWorkflow.searchFields, [])
      assert.equal(JSON.stringify(otherWorkflow).includes("secretKey"), false)
      assert.equal(JSON.stringify(otherWorkflow).includes("foreign-rev"), false)

      const otherProject = Result.getOrThrow(
        await run(
          getWorkflowMeaningPage(other, { workflow: "secret.workflow" }),
        ),
      )
      assert.deepEqual(
        otherProject.revisions.map((revision) => revision.revision),
        ["foreign-rev"],
      )
      assert.deepEqual(otherProject.lookupKeys, ["secretKey"])

      const mismatchedProject = await run(
        getWorkflowMeaningPage(project, {
          workflow: "alpha",
          cursor: encodeRevisionDiscoveryCursor({
            projectId: other,
            workflow: "alpha",
            createdAt: "2026-01-01T00:00:00.000Z",
            id: foreignId,
          }),
        }),
      )
      Result.match(mismatchedProject, {
        onFailure: (error) =>
          assert.equal(error.message, "Invalid workflow discovery cursor."),
        onSuccess: () => assert.fail("foreign revision cursor changed scope"),
      })
    } finally {
      await close()
    }
  },
)
