import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { assessLiveCoverage } from "@flowmarkdev/core"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { WorkflowStore } from "../../src/persistence/workflows/workflow-store.js"

const url = process.env.TEST_DATABASE_URL
const release = `sha256:${"a".repeat(64)}`
const handle = `hmac-sha256:${"ab".repeat(32)}`
const start = "2026-11-01T00:00:00.000Z"
const end = "2026-11-02T00:00:00.000Z"

const observation = (kind: "observation" | "loss") => ({
  observation: {
    kind,
    probe: {
      bindingId: "00000000-0000-4000-8000-000000000001",
      deploymentId: "deploy-1",
      artifactDigest: release,
      probeId: "booking-delivery",
    },
    ...(kind === "observation"
      ? {
          references: [
            { kind: "change", namespace: "reschedule", digest: handle },
          ],
        }
      : { count: 1 }),
  },
  binding: {
    status: "bound",
    manifestDigest: release,
    revision: "a".repeat(40),
    environment: "production",
    behaviorId: "booking",
    behaviorRevision: "receipt-v1",
  },
})

test(
  "coverage reconciliation stays inside the project, artifact and window",
  { skip: !url },
  async () => {
    const { db, close } = createDatabase(url!)
    const workspaceId = randomUUID()
    const projectId = randomUUID()
    const foreignProjectId = randomUUID()
    const workflowId = randomUUID()
    const foreignWorkflowId = randomUUID()
    const runId = randomUUID()
    const foreignRunId = randomUUID()
    const first = randomUUID()
    const duplicate = randomUUID()
    const foreign = randomUUID()
    try {
      await db.execute(
        sql`INSERT INTO workspaces(id, name) VALUES (${workspaceId}, 'Coverage')`,
      )
      await db.execute(sql`
        INSERT INTO projects(id, workspace_id, name) VALUES
          (${projectId}, ${workspaceId}, 'Coverage'),
          (${foreignProjectId}, ${workspaceId}, 'Foreign coverage')
      `)
      await db.execute(sql`
        INSERT INTO workflows(id, project_id, name) VALUES
          (${workflowId}, ${projectId}, 'bookings'),
          (${foreignWorkflowId}, ${foreignProjectId}, 'bookings')
      `)
      await db.execute(sql`
        INSERT INTO workflow_runs(id, workflow_id, external_id, started_at) VALUES
          (${runId}, ${workflowId}, 'case', ${start}),
          (${foreignRunId}, ${foreignWorkflowId}, 'foreign', ${start})
      `)
      const insert = (
        eventId: string,
        targetRun: string,
        body: ReturnType<typeof observation>,
      ) =>
        db.execute(sql`
          INSERT INTO workflow_events(event_id, run_id, type, occurred_at, runtime_observation)
          VALUES (
            ${eventId},
            ${targetRun},
            'step',
            ${start},
            ${JSON.stringify(body)}::jsonb
          )
        `)
      await insert(first, runId, observation("observation"))
      await insert(duplicate, runId, observation("observation"))
      await insert(foreign, foreignRunId, observation("observation"))
      const store = await Effect.runPromise(
        WorkflowStore.make.pipe(Effect.provideService(Database, db)),
      )
      const page = await Effect.runPromise(
        store.coverageObservations(projectId, {
          environment: "production",
          artifactDigest: release,
          behaviorRevision: "receipt-v1",
          startedAt: start,
          endedAt: end,
        }),
      )
      assert.equal(page.truncated, false)
      assert.deepEqual(
        page.events.map((event) => event.eventId).sort(),
        [duplicate, first].sort(),
      )
      const assessed = assessLiveCoverage({
        questionId: "booking.receipt-link",
        questionRevision: 1,
        release,
        behaviorRevision: "receipt-v1",
        environment: "production",
        provenance: "fixture",
        populationSource: { id: "booking-outbox", kind: "outbox" },
        window: { start, end },
        maturityDelayMs: 0,
        observedAt: end,
        supportExpiresAt: null,
        sampling: "complete",
        join: "case-handle",
        drilldownLimit: 8,
        permittedHandles: [],
        discovery: "unknown",
        readiness: "unknown",
        population: [{ handle, eligibleAt: "2026-11-01T01:00:00.000Z" }],
        deliveries: [],
        stored: page.events,
        storedTruncated: page.truncated,
      })
      assert.equal(assessed.answerability.resolved, 1)
      assert.equal(assessed.answerability.eligible, 1)
      assert.equal(assessed.answerability.rate?.resolved, 1)
      assert.equal(assessed.discovery.status, "unknown")
      assert.equal(assessed.readiness.status, "unknown")
      assert.deepEqual(assessed.answerability.outcomes, [])
      await db.execute(sql`
        INSERT INTO workflow_events(event_id, run_id, type, occurred_at, runtime_observation)
        SELECT gen_random_uuid(), ${runId}::uuid, 'step', ${start}::timestamptz,
          ${JSON.stringify(observation("observation"))}::jsonb
        FROM generate_series(1, 401)
      `)
      const truncated = await Effect.runPromise(
        store.coverageObservations(projectId, {
          environment: "production",
          artifactDigest: release,
          behaviorRevision: "receipt-v1",
          startedAt: start,
          endedAt: end,
        }),
      )
      assert.equal(truncated.truncated, true)
      assert.equal(truncated.events.length, 400)
    } finally {
      await close()
    }
  },
)
