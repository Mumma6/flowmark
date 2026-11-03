import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { Effect } from "effect"
import { createDatabase } from "@flowmark/db"
import { assertTestDatabaseTarget } from "@flowmark/db/commands"
import { Database, WorkflowStore } from "@flowmark/db/persistence"
import { findFixtureAccount } from "@flowmark/db/fixtures"
import { createFlowmarkAuth } from "@flowmark/auth"
import { IngestWorkflowEvents, ManageProject } from "@flowmark/api"
import {
  protectedFingerprints,
  fixtureRunRows,
  fixtureEmailVerified,
} from "../../db/test/support/meridian.js"
import { generate, defaultSeed, summarize } from "../src/generator/generate.js"
import { operateDataset } from "../src/lifecycle/dataset.js"
import { setupAccount } from "../src/provisioning/account.js"
import { makeAuthHttp } from "../src/provisioning/auth-http.js"
import { fixtureApi } from "../src/runtime.js"
import { ACCOUNT_EMAIL } from "../src/scenarios/catalog.js"

test(
  "Meridian provisioning, real ingestion, analytics, isolated seed/reset/reseed and tamper refusal",
  { skip: !process.env.TEST_DATABASE_URL, timeout: 300000 },
  async (context) => {
    await Effect.runPromise(assertTestDatabaseTarget())
    const { db, close } = createDatabase(process.env.TEST_DATABASE_URL!, {
      prepare: true,
    })
    const execute = <A, E>(operation: Effect.Effect<A, E>) =>
      Effect.runPromise(operation, { signal: context.signal })
    const password = randomUUID()
    const provider = createFlowmarkAuth({
      db,
      secret: randomUUID() + randomUUID(),
      baseURL: "http://localhost:3001",
      trustedOrigins: ["http://localhost:3001"],
    })
    try {
      const auth = await execute(
        makeAuthHttp("http://localhost:3001", provider.handler),
      )
      await assert.rejects(execute(setupAccount(db, auth, "short")))
      const setup = await execute(setupAccount(db, auth, password))
      console.info("Meridian: ordinary account provisioning completed.")
      assert.equal(setup.created, true)
      assert.ok(setup.key)
      const again = await execute(setupAccount(db, auth, password))
      assert.equal(again.created, false)
      assert.equal(again.projectId, setup.projectId)
      assert.equal(again.key, undefined)
      assert.deepEqual(
        Array.from(await fixtureEmailVerified(db, ACCOUNT_EMAIL)),
        [{ verified: false }],
      )
      const account = await execute(
        findFixtureAccount(ACCOUNT_EMAIL).pipe(
          Effect.provideService(Database, db),
        ),
      )
      assert.ok(account)
      const other = await execute(
        Effect.gen(function* () {
          return yield* (yield* ManageProject).create(
            account.id,
            "Other synthetic integration project",
          )
        }).pipe(Effect.provide(fixtureApi(db))),
      )
      const append = (key: string, event: object) =>
        execute(
          Effect.gen(function* () {
            return yield* (yield* IngestWorkflowEvents).ingest(
              `Bearer ${key}`,
              Effect.succeed({ eventId: randomUUID(), event }),
              true,
            )
          }).pipe(Effect.provide(fixtureApi(db))),
        )
      await append(setup.key, {
        type: "started",
        workflow: "appointment.book",
        runId: "manual-meridian-run",
        timestamp: "2026-11-03T10:00:00.000Z",
        properties: { origin: "manual" },
      })
      await append(other.writeKey.secret, {
        type: "started",
        workflow: "appointment.book",
        runId: "other-project-run",
        timestamp: "2026-11-03T10:00:00.000Z",
      })
      const otherBefore = Array.from(await fixtureRunRows(db, other.project.id))
      const data = generate({
        reference: "2026-11-03T12:00:00.000Z",
        seed: defaultSeed,
      })
      const summary = summarize(data)
      const run = (
        operation: "seed" | "reset" | "reseed" | "status",
        dataset = data,
        key = setup.key!,
      ) =>
        execute(
          operateDataset(db, {
            projectId: setup.projectId,
            key,
            dataset,
            operation,
            onProgress: (count, total) =>
              Effect.sync(() =>
                console.info(`Meridian ${operation}: ${count}/${total} runs.`),
              ),
          }),
        )
      await assert.rejects(run("seed", data, other.writeKey.secret))
      const seeded = await run("seed")
      assert.equal(seeded.runs, summary.runs)
      assert.equal(seeded.events, summary.events)
      assert.equal(seeded.complete, true)
      const protectedBefore = Array.from(await protectedFingerprints(db))
      assert.deepEqual(await run("seed"), seeded)
      const store = <A, E>(
        query: (service: WorkflowStore["Service"]) => Effect.Effect<A, E>,
      ) =>
        execute(
          WorkflowStore.use(query).pipe(
            Effect.provide(WorkflowStore.layer),
            Effect.provideService(Database, db),
          ),
        )
      const search = await store((service) =>
        service.search(setup.projectId, "SYN-BOOK-RECENT"),
      )
      assert.ok(
        search.references.some((item) => item.value === "SYN-BOOK-RECENT"),
      )
      const workflows = await store((service) =>
        service.workflows(setup.projectId),
      )
      assert.equal(workflows.length, 6)
      const rows = await fixtureRunRows(db, setup.projectId)
      const late = data.runs.find((item) =>
        item.events.some(
          ({ event }) =>
            event.type === "expectation_resolved" &&
            Date.parse(event.timestamp) -
              Date.parse(item.events[0]!.event.timestamp) >
              3600000,
        ),
      )!
      const lateRow = rows.find((row) => row.externalId === late.runId)!
      const expectations = await store((service) =>
        service.expectations(setup.projectId, lateRow.id),
      )
      assert.equal(expectations.expectations[0]!.state, "met-late")
      const matching = rows.find((row) => row.workflow === "patient.match")!
      const related = await store((service) =>
        service.related(setup.projectId, matching.id),
      )
      assert.ok(JSON.stringify(related).includes("referral.ingest"))
      const business = await store((service) =>
        service.businessInsights(setup.projectId, {
          workflow: "referral.ingest",
          revision: "meridian-v1",
          path: ["rejected"],
          currentStartedAfter: "2026-10-21T12:00:00.000Z",
          currentStartedBefore: "2026-10-27T12:00:00.000Z",
          previousStartedAfter: "2026-10-04T12:00:00.000Z",
          previousStartedBefore: "2026-10-10T12:00:00.000Z",
          businessKey: "provider",
          businessValue: "cedar-health",
        }),
      )
      assert.ok(
        Number(
          business.windows.find((window) => window.scope === "current")?.total,
        ) >
          Number(
            business.windows.find((window) => window.scope === "previous")
              ?.total,
          ),
      )
      await assert.rejects(
        run("seed", generate({ ...data.config, seed: "different" })),
      )
      assert.deepEqual(await run("status"), seeded)
      assert.equal((await run("reset")).runs, 0)
      assert.deepEqual(
        (await fixtureRunRows(db, setup.projectId)).map(
          (row) => row.externalId,
        ),
        ["manual-meridian-run"],
      )
      assert.equal((await run("reset")).events, 0)
      assert.deepEqual(await run("reseed"), seeded)
      assert.deepEqual(
        Array.from(await protectedFingerprints(db)),
        protectedBefore,
      )
      assert.deepEqual(
        Array.from(await fixtureRunRows(db, other.project.id)),
        otherBefore,
      )
      const incomplete = data.runs.find(
        (item) =>
          !item.events.some(
            ({ event }) =>
              event.type === "completed" || event.type === "failed",
          ),
      )!
      assert.equal(
        await append(setup.key, {
          type: "step",
          workflow: incomplete.workflow,
          runId: incomplete.runId,
          timestamp: "2026-11-03T11:59:00.000Z",
          step: "manual-observation",
        }),
        "recorded",
      )
      await assert.rejects(run("reset"))
      await assert.rejects(run("reseed"))
      assert.equal(
        (await fixtureRunRows(db, setup.projectId)).length,
        summary.runs + 1,
      )
      assert.deepEqual(
        Array.from(await protectedFingerprints(db)),
        protectedBefore,
      )
    } finally {
      await close()
    }
  },
)
