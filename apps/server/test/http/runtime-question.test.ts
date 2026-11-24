import { createHash, randomBytes, randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Schema } from "effect"
import {
  RuntimeQuestionCheckSchema,
  type RuntimeQuestionCheck,
} from "@flowmark/api"
import {
  createDatabase,
  deploymentBindings,
  projectApiKeys,
  projects,
  workspaces,
} from "@flowmark/db"
import { hashApiKey } from "@flowmark/db/persistence"
import {
  createFlowmark,
  createRuntimeObservationEmitter,
} from "../../../../packages/sdk/src/index.js"
import declaration from "../../../../examples/questions/committed-receipt.json"
import confirmation from "../../../../examples/questions/later-confirmation.json"
import { POST as deployment } from "../../app/v1/deployments/route"
import { POST as ingest } from "../../app/v1/events/route"
import { POST as readFixture } from "../../app/api/trpc/[trpc]/route"
import { appRouter } from "../../src/adapters/trpc/router"

describe.skipIf(!process.env.TEST_DATABASE_URL)(
  "committed receipt question through SDK, transaction and scoped reads",
  () => {
    const projectId = randomUUID(),
      workspaceId = randomUUID(),
      bindingId = randomUUID()
    const writeKey = randomUUID(),
      readKey = randomUUID(),
      referenceKey = randomUUID()
    const foreignKey = randomUUID(),
      foreignProjectId = randomUUID()
    const token = "fmd_" + randomBytes(32).toString("hex")
    const deploymentId = "fixture-" + randomUUID()
    const artifactDigest = "sha256:" + "c".repeat(64)
    const sourceRevision = "a".repeat(40)
    const workflow = "payment.reconcile"
    const table = sql.identifier(
      "payment_receipt_" + randomUUID().replaceAll("-", ""),
    )
    const policy = {
      environment: "fixture",
      fixture: "payment-receipt-transaction",
      questionId: "payments.receipt-before-retry",
      questionRevision: 1,
      allowedChangeNamespaces: ["payment.request"],
      bindingId,
      deploymentId,
      sourceRevision,
      artifactDigest,
    }
    const input = Schema.decodeUnknownSync(RuntimeQuestionCheckSchema)({
      ...policy,
      question: declaration,
    }) as Extract<
      RuntimeQuestionCheck,
      { question: { predicate: "receipt-for-same-change" } }
    >
    const caller = (key: string) =>
      appRouter.createCaller({
        request: new Request("http://localhost/api/trpc", {
          headers: { authorization: "Bearer " + key },
        }),
      })
    const api = caller(readKey)
    let connection: ReturnType<typeof createDatabase>
    async function registerFixture(target: typeof policy, sourcePath: string) {
      const registered = await deployment(
        new Request("http://localhost/v1/deployments", {
          method: "POST",
          headers: { authorization: "Bearer " + token },
          body: JSON.stringify({
            bindingId,
            deploymentId: target.deploymentId,
            manifest: {
              version: 1,
              repository: "example/payments",
              artifactDigest: target.artifactDigest,
              revision: target.sourceRevision,
              probes: [
                "payment.request",
                "payment.receipt-committed",
                "payment.attempt",
                "payment.confirmation",
              ].map((probeId) => ({
                probeId,
                behaviorId: "payment.receipt",
                behaviorRevision: "1",
                location: {
                  kind: "source",
                  path: sourcePath,
                  symbol: probeId,
                },
              })),
            },
          }),
        }),
      )
      expect(registered.status).toBe(200)
    }
    beforeAll(async () => {
      vi.stubEnv("DATABASE_URL", process.env.TEST_DATABASE_URL!)
      vi.stubEnv("FLOWMARK_DEMO_MODE", "false")
      connection = createDatabase(process.env.TEST_DATABASE_URL!)
      const { db } = connection
      await db.execute(sql`create table ${table} (request_id uuid primary key)`)
      await db
        .insert(workspaces)
        .values({ id: workspaceId, name: "Question fixture" })
      await db.insert(projects).values([
        { id: projectId, workspaceId, name: "Receipt fixture" },
        { id: foreignProjectId, workspaceId, name: "Other fixture" },
      ])
      await db.insert(projectApiKeys).values([
        { projectId, keyHash: hashApiKey(writeKey), permission: "write" },
        { projectId, keyHash: hashApiKey(readKey), permission: "read" },
        {
          projectId: foreignProjectId,
          keyHash: hashApiKey(foreignKey),
          permission: "read",
        },
      ])
      await db.insert(deploymentBindings).values({
        id: bindingId,
        projectId,
        repository: "example/payments",
        service: "receipt-worker",
        environment: "fixture",
        secretHash: createHash("sha256").update(token).digest("hex"),
      })
      await registerFixture(policy, "receipt.ts")
      vi.stubGlobal("fetch", (url: RequestInfo | URL, init?: RequestInit) =>
        ingest(new Request(url, init)),
      )
    })
    afterAll(async () => {
      try {
        if (connection) {
          await connection.db.execute(sql`drop table if exists ${table}`)
        }
      } finally {
        await connection?.close()
        vi.unstubAllGlobals()
        vi.unstubAllEnvs()
      }
    })

    async function exercise(
      which: "linked" | "otherRequest" | "rollback",
      fault?: "missing-link" | "early-commit",
      target = policy,
    ) {
      const request = randomUUID()
      const receipt = which === "otherRequest" ? randomUUID() : request
      const diagnostics = vi.fn()
      const client = createFlowmark({
        apiUrl: "http://localhost",
        apiKey: writeKey,
        environment: "fixture",
        onInstrumentationError: diagnostics,
      })
      const flow = client.workflow(workflow)
      const emitter = (probeId: string) =>
        createRuntimeObservationEmitter({
          key: referenceKey,
          namespaces: [{ kind: "change", namespace: "payment.request" }],
          probe: {
            bindingId,
            deploymentId: target.deploymentId,
            artifactDigest: target.artifactDigest,
            probeId,
          },
        })
      const observeReceipt = () =>
        emitter("payment.receipt-committed").observe(
          flow,
          fault === "missing-link"
            ? {}
            : { change: { "payment.request": receipt } },
        )
      const forced = new Error("fixture rollback")
      try {
        emitter("payment.request").observe(flow, {
          change: { "payment.request": request },
        })
        try {
          await connection.db.transaction(async (tx) => {
            await tx.execute(sql`insert into ${table} values (${receipt})`)
            if (fault === "early-commit") {
              observeReceipt()
            }
            if (which === "rollback") {
              throw forced
            }
          })
          observeReceipt()
          flow.done()
        } catch (error) {
          if (error !== forced) {
            throw error
          }
          flow.fail({ code: "rolled-back" })
        }
        const committed = await connection.db.execute(
          sql`select request_id from ${table} where request_id = ${receipt}`,
        )
        expect(committed.length).toBe(which === "rollback" ? 0 : 1)
      } finally {
        await client.shutdown()
      }
      expect(diagnostics).not.toHaveBeenCalled()
      const found = await api.run.list({ workflow, externalId: flow.runId })
      expect(found.total).toBe(1)
      return found.runs[0]!.id
    }

    it("distinguishes the original request, a different request and a genuine rollback", async () => {
      const runs = {
        linked: await exercise("linked"),
        otherRequest: await exercise("otherRequest"),
        rollback: await exercise("rollback"),
      }
      const check = (overrides: Partial<typeof input> = {}) =>
        api.run.questionReadiness({ ...input, runs, ...overrides })
      expect(await check()).toEqual({
        status: "verified",
        reason: "persisted-fixture-distinction",
      })
      expect(
        await check({
          runs: { ...runs, linked: await exercise("linked", "missing-link") },
        }),
      ).toMatchObject({ status: "missing", reason: "missing-change-link" })
      expect(
        await check({
          runs: {
            ...runs,
            rollback: await exercise("rollback", "early-commit"),
          },
        }),
      ).toMatchObject({
        status: "failed",
        reason: "commit-reported-on-rollback",
      })
      expect(
        await check({
          runs: {
            ...runs,
            linked: runs.otherRequest,
            otherRequest: runs.linked,
          },
        }),
      ).toMatchObject({ status: "failed", reason: "wrong-request-distinction" })
      expect(await check({ sourceRevision: "b".repeat(40) })).toMatchObject({
        status: "stale",
      })
      expect(
        await caller(foreignKey).run.questionReadiness({ ...input, runs }),
      ).toEqual({ status: "missing", reason: "deployment-receipt-missing" })
      expect(await check({ allowedChangeNamespaces: [] })).toMatchObject({
        status: "failed",
        reason: "field-outside-fixture-policy",
      })
      const excluded = { ...input.question, excludedReason: "retired" as const }
      expect(await check({ question: excluded })).toMatchObject({
        status: "failed",
        reason: "unapproved-exclusion",
      })
      expect(
        await check({ question: excluded, approvedExclusion: "retired" }),
      ).toMatchObject({ status: "excluded" })
      await expect(
        caller(writeKey).run.questionReadiness({
          ...input,
          question: excluded,
          approvedExclusion: "retired",
        }),
      ).rejects.toThrow()
    })
    it("keeps the same question answerable after the reporting site moves", async () => {
      const moved = {
        ...policy,
        deploymentId: "moved-" + randomUUID(),
        artifactDigest: "sha256:" + "d".repeat(64),
        sourceRevision: "b".repeat(40),
      }
      await registerFixture(moved, "workers/receipts.ts")
      const runs = {
        linked: await exercise("linked", undefined, moved),
        otherRequest: await exercise("otherRequest", undefined, moved),
        rollback: await exercise("rollback", undefined, moved),
      }
      const response = await readFixture(
        new Request("http://localhost/api/trpc/run.questionReadiness", {
          method: "POST",
          headers: {
            authorization: "Bearer " + readKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            ...input,
            ...moved,
            previousQuestion: input.question,
            runs,
          }),
        }),
      )
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        result: { data: { status: "verified" } },
      })
    })

    it("requires the linked, other-change and unlinked confirmation fixtures", async () => {
      const confirm = async (which: "linked" | "otherChange" | "unlinked") => {
        const attempt = randomUUID()
        const confirmed = which === "otherChange" ? randomUUID() : attempt
        const client = createFlowmark({
          apiUrl: "http://localhost",
          apiKey: writeKey,
          environment: "fixture",
        })
        const flow = client.workflow(workflow)
        const emitter = (probeId: string) =>
          createRuntimeObservationEmitter({
            key: referenceKey,
            namespaces: [{ kind: "change", namespace: "payment.request" }],
            probe: {
              bindingId,
              deploymentId: policy.deploymentId,
              artifactDigest: policy.artifactDigest,
              probeId,
            },
          })
        emitter("payment.attempt").observe(flow, {
          change: { "payment.request": attempt },
        })
        emitter("payment.confirmation").observe(
          flow,
          which === "unlinked"
            ? {}
            : { change: { "payment.request": confirmed } },
        )
        flow.done()
        await client.shutdown()
        const found = await api.run.list({ workflow, externalId: flow.runId })
        expect(found.total).toBe(1)
        return found.runs[0]!.id
      }
      expect(
        await api.run.questionReadiness({
          environment: input.environment,
          questionId: confirmation.id,
          questionRevision: confirmation.revision,
          fixture: confirmation.fixture,
          allowedChangeNamespaces: input.allowedChangeNamespaces,
          bindingId: input.bindingId,
          deploymentId: input.deploymentId,
          artifactDigest: input.artifactDigest,
          sourceRevision: input.sourceRevision,
          question: confirmation as unknown as Extract<
            RuntimeQuestionCheck,
            { question: { predicate: "confirmation-for-same-change" } }
          >["question"],
          runs: {
            linked: await confirm("linked"),
            otherChange: await confirm("otherChange"),
            unlinked: await confirm("unlinked"),
          },
        }),
      ).toEqual({
        status: "verified",
        reason: "persisted-fixture-distinction",
      })
    })
  },
)
