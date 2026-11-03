import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { searchProject } from "../../src/persistence/workflows/queries/search-project.js"

const url = process.env.TEST_DATABASE_URL

test(
  "project search stays inside the project and the enabled reference contract",
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
    const customerWorkflow = randomUUID()
    const otherWorkflow = randomUUID()
    const percentWorkflow = randomUUID()
    const wildcardWorkflow = randomUUID()
    const customerRun = randomUUID()
    const otherValueRun = randomUUID()
    const otherProjectRun = randomUUID()
    const search = (projectId: string, query: string) =>
      Effect.runPromise(
        searchProject(projectId, query).pipe(
          Effect.provideService(Database, db),
        ),
      )
    try {
      await db.execute(
        sql`INSERT INTO workspaces(id, name) VALUES (${workspace}, 'search-test')`,
      )
      await db.execute(
        sql`INSERT INTO projects(id, workspace_id, name) VALUES (${project}, ${workspace}, 'search'), (${other}, ${workspace}, 'other')`,
      )
      await db.execute(sql`
        INSERT INTO workflows(id, project_id, name) VALUES
          (${customerWorkflow}, ${project}, 'customer.import'),
          (${percentWorkflow}, ${project}, '100%_done'),
          (${wildcardWorkflow}, ${project}, '100Xdone'),
          (${otherWorkflow}, ${other}, 'customer.import')
      `)
      for (const index of [1, 2, 3, 4, 5, 6]) {
        await db.execute(
          sql`INSERT INTO workflows(id, project_id, name) VALUES (${randomUUID()}, ${project}, ${`alpha-${index}`})`,
        )
      }
      await db.execute(sql`
        INSERT INTO workflow_runs(id, workflow_id, external_id, started_at, properties) VALUES
          (${customerRun}, ${customerWorkflow}, 'ext-customer-a', '2026-10-20T00:00:00Z', ${JSON.stringify({ customerId: "cust-1", provider: "crm-a", secret: "cust-1" })}::jsonb),
          (${otherValueRun}, ${customerWorkflow}, 'ext-customer-b', '2026-10-19T00:00:00Z', ${JSON.stringify({ provider: "other" })}::jsonb),
          (${otherProjectRun}, ${otherWorkflow}, 'ext-other', '2026-10-20T00:00:00Z', ${JSON.stringify({ customerId: "cust-1" })}::jsonb)
      `)
      await db.execute(sql`
        INSERT INTO workflow_run_facts(run_id, version, source_receipt, selection, status, fail_code) VALUES
          (${customerRun}, 1, 1, '{}'::jsonb, 'Failed', 'MISSING'),
          (${otherValueRun}, 1, 1, '{}'::jsonb, 'Completed', null),
          (${otherProjectRun}, 1, 1, '{}'::jsonb, 'Completed', null)
      `)
      await db.execute(sql`
        INSERT INTO workflow_search_fields(project_id, workflow, fields) VALUES
          (${project}, 'customer.import', ${JSON.stringify([
            { key: "customerId", role: "lookup" },
            { key: "provider", role: "dimension", values: ["crm-a"] },
          ])}::jsonb),
          (${other}, 'customer.import', ${JSON.stringify([
            { key: "customerId", role: "lookup" },
          ])}::jsonb)
      `)

      const names = await search(project, "alpha-")
      assert.deepEqual(
        names.workflows.map((workflow) => workflow.name),
        ["alpha-1", "alpha-2", "alpha-3", "alpha-4", "alpha-5"],
      )
      assert.equal(names.references.length, 0)

      const escaped = await search(project, "100%_")
      assert.deepEqual(
        escaped.workflows.map((workflow) => workflow.name),
        ["100%_done"],
      )

      const reference = await search(project, "cust-1")
      assert.deepEqual(
        reference.references.map((item) => item.key),
        ["customerId"],
      )
      assert.equal(reference.references[0]?.runId, customerRun)
      assert.equal(
        reference.runs.some((run) => run.id === otherProjectRun),
        false,
      )

      const dimension = await search(project, "crm-a")
      assert.equal(dimension.references[0]?.runId, customerRun)
      assert.equal(dimension.references[0]?.key, "provider")
      const disallowed = await search(project, "other")
      assert.equal(disallowed.references.length, 0)

      const runs = await search(project, "missing")
      assert.deepEqual(
        runs.runs.map((run) => run.id),
        [customerRun],
      )
      assert.equal(runs.references.length, 0)

      const isolated = await search(other, "cust-1")
      assert.deepEqual(
        isolated.references.map((item) => item.runId),
        [otherProjectRun],
      )
      assert.equal(
        isolated.workflows.some((workflow) =>
          workflow.name.startsWith("alpha"),
        ),
        false,
      )
    } finally {
      await close()
    }
  },
)
