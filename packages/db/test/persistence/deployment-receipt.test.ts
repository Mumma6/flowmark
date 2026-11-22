import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import {
  createArtifactManifest,
  type RuntimeProbeReference,
} from "@flowmarkdev/core"
import { eq } from "drizzle-orm"
import { Effect } from "effect"
import { createDatabase } from "../../src/client.js"
import { Database } from "../../src/persistence/database.js"
import { WorkflowStore } from "../../src/persistence/workflows/workflow-store.js"
import { DeploymentStore } from "../../src/persistence/runtime-deployment/deployment-store.js"
import {
  projects,
  projectMembers,
  user,
  workspaces,
  workflowEvents,
} from "../../src/schema/index.js"

const url = process.env.TEST_DATABASE_URL

test(
  "deployment receipts preserve retries, parallel artifacts and rollback within their binding",
  { skip: !url },
  async () => {
    const client = createDatabase(url!)
    const { db } = client
    const workspaceId = randomUUID()
    const projectId = randomUUID()
    const foreignProjectId = randomUUID()
    const owner = randomUUID()
    const foreignOwner = randomUUID()

    try {
      await db.insert(user).values([
        { id: owner, name: "Owner", email: `${owner}@example.test` },
        {
          id: foreignOwner,
          name: "Foreign owner",
          email: `${foreignOwner}@example.test`,
        },
      ])
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Deployment fixture" })
      await db.insert(projects).values([
        { id: projectId, workspaceId, name: "Deployment fixture" },
        { id: foreignProjectId, workspaceId, name: "Foreign project" },
      ])
      await db.insert(projectMembers).values([
        { projectId, userId: owner, role: "owner" },
        { projectId: foreignProjectId, userId: foreignOwner, role: "owner" },
      ])

      const store = await Effect.runPromise(
        DeploymentStore.make.pipe(Effect.provideService(Database, db)),
      )
      const scope = {
        projectId,
        repository: "example/app",
        service: "worker",
        environment: "production",
      }
      const first = await Effect.runPromise(
        store.rotateBinding(owner, scope, "first-secret"),
      )
      const foreign = await Effect.runPromise(
        store.rotateBinding(
          foreignOwner,
          { ...scope, projectId: foreignProjectId },
          "foreign-secret",
        ),
      )
      const callback = (deploymentId: string, artifact: string) => ({
        bindingId: first.id,
        secretHash: "first-secret",
        deploymentId,
        manifestDigest: `sha256:${artifact.repeat(64)}`,
        manifest: createArtifactManifest({
          version: 1,
          repository: scope.repository,
          revision: artifact.repeat(40),
          artifactDigest: `sha256:${artifact.repeat(64)}`,
          probes: [
            {
              probeId: "delivery",
              behaviorId: "booking.reschedule",
              behaviorRevision: "2",
              location: {
                kind: "source",
                path: "booking.ts",
                symbol: "deliver",
              },
            },
          ],
        }),
      })
      const record = (input: Parameters<typeof store.record>[0]) =>
        Effect.runPromise(store.record(input))
      const original = callback("deploy-1", "a")
      const [one, retry, parallel] = await Promise.all([
        record(original),
        record(original),
        record(callback("deploy-2", "b")),
      ])
      assert.equal(one.status, "recorded")
      assert.deepEqual(retry, one)
      assert.equal(parallel.status, "recorded")
      const rollback = await record(callback("deploy-3", "a"))
      assert.equal(rollback.status, "recorded")
      assert.deepEqual(await record(callback("deploy-1", "b")), {
        status: "conflict",
      })
      assert.deepEqual(await record({ ...original, bindingId: foreign.id }), {
        status: "denied",
      })
      assert.deepEqual(
        await record({
          ...original,
          manifest: { ...original.manifest, repository: "foreign/app" },
        }),
        { status: "denied" },
      )
      assert.equal(
        await Effect.runPromise(
          store.read(foreignOwner, foreignProjectId, first.id, "deploy-1"),
        ),
        null,
      )
      await assert.rejects(
        Effect.runPromise(
          store.read(foreignOwner, projectId, first.id, "deploy-1"),
        ),
      )
      const rotated = await Effect.runPromise(
        store.rotateBinding(owner, scope, "new-secret"),
      )
      assert.equal(rotated.id, first.id)
      assert.deepEqual(await record(original), { status: "denied" })
      const prior = await Effect.runPromise(
        store.read(owner, projectId, rotated.id, "deploy-1"),
      )
      assert.equal(
        prior?.receipt.manifest.artifactDigest,
        original.manifest.artifactDigest,
      )
      assert.equal(prior?.environment, "production")

      const workflows = await Effect.runPromise(
        WorkflowStore.make.pipe(Effect.provideService(Database, db)),
      )
      const timestamp = "2026-11-22T10:10:10.000Z"
      const firstRun = {
        workflow: "booking.reschedule",
        runId: "first",
        timestamp,
      }
      const retryRun = { ...firstRun, runId: "retry" }
      await Effect.runPromise(
        workflows.append(projectId, randomUUID(), {
          ...firstRun,
          type: "started",
        }),
      )
      await Effect.runPromise(
        workflows.append(projectId, randomUUID(), {
          ...retryRun,
          type: "started",
          retryOf: { workflow: firstRun.workflow, runId: firstRun.runId },
        }),
      )
      const probe = {
        bindingId: first.id,
        deploymentId: original.deploymentId,
        artifactDigest: original.manifest.artifactDigest,
        probeId: "delivery",
      }
      const observed = (
        run: typeof firstRun,
        eventId: string,
        reference?: RuntimeProbeReference,
      ) =>
        Effect.runPromise(
          workflows.append(projectId, eventId, {
            ...run,
            type: "step",
            step: "runtime.observation",
            observation: {
              kind: "observation",
              probe: reference,
              references: [],
            },
          }),
        )
      const firstId = randomUUID()
      const retryId = randomUUID()
      const statuses = await Promise.all([
        observed(firstRun, firstId, probe),
        observed(firstRun, firstId, probe),
        observed(retryRun, retryId, probe),
      ])
      assert.deepEqual(statuses.toSorted(), [
        "duplicate",
        "recorded",
        "recorded",
      ])
      const stored = (eventId: string) =>
        db.query.workflowEvents.findFirst({
          where: eq(workflowEvents.eventId, eventId),
        })
      const firstEvent = await stored(firstId)
      const retryEvent = await stored(retryId)
      assert.notEqual(firstEvent?.runId, retryEvent?.runId)
      assert.equal(firstEvent?.occurredAt.toISOString(), timestamp)
      assert.ok(firstEvent?.createdAt instanceof Date)
      assert.deepEqual(firstEvent?.runtimeObservation?.binding, {
        status: "bound",
        revision: original.manifest.revision,
        manifestDigest: original.manifestDigest,
        behaviorId: "booking.reschedule",
        behaviorRevision: "2",
        environment: "production",
      })
      const foreignReceipt = await record({
        ...original,
        bindingId: foreign.id,
        secretHash: "foreign-secret",
      })
      assert.equal(foreignReceipt.status, "recorded")
      const missingId = randomUUID()
      const foreignId = randomUUID()
      const absentId = randomUUID()
      const mismatchedArtifactId = randomUUID()
      const unknownProbeId = randomUUID()
      await observed(firstRun, missingId, { ...probe, deploymentId: "missing" })
      await observed(firstRun, foreignId, { ...probe, bindingId: foreign.id })
      await observed(firstRun, absentId)
      await observed(firstRun, mismatchedArtifactId, {
        ...probe,
        artifactDigest: `sha256:${"c".repeat(64)}`,
      })
      await observed(firstRun, unknownProbeId, {
        ...probe,
        probeId: "missing-probe",
      })
      const unknownEvents = await Promise.all(
        [
          missingId,
          foreignId,
          absentId,
          mismatchedArtifactId,
          unknownProbeId,
        ].map(stored),
      )
      assert.deepEqual(
        unknownEvents.map((event) => event?.runtimeObservation?.binding),
        Array.from({ length: unknownEvents.length }, () => ({
          status: "unknown",
        })),
      )
      const lossId = randomUUID()
      await Effect.runPromise(
        workflows.append(projectId, lossId, {
          ...firstRun,
          type: "step",
          step: "runtime.observation",
          observation: { kind: "loss", count: 1, probe },
        }),
      )
      assert.deepEqual(
        (await stored(lossId))?.runtimeObservation?.observation,
        { kind: "loss", count: 1, probe },
      )
    } finally {
      await client.close()
    }
  },
)
