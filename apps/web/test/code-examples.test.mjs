import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const compile = (source) =>
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
const exports = {}
runInNewContext(
  compile(
    readFileSync(
      new URL(
        "../features/product-landing/instrumentation-example.ts",
        import.meta.url,
      ),
      "utf8",
    ),
  ),
  { exports },
)

function execute({ accepted = true, failure } = {}) {
  const events = []
  const submissions = []
  const job = { accepted, reference: "SYN-BOOK-RECENT" }
  const completion = {
    version: 1,
    workflow: "customer.sync",
    runId: "synthetic-run-id",
    expectationId: "synthetic-completion-id",
  }
  const run = {
    expect: (...args) => {
      events.push(["expect", ...args])
      return completion
    },
    done: (...args) => events.push(["done", ...args]),
    fail: (...args) => events.push(["fail", ...args]),
  }
  const fn = runInNewContext(
    `${compile(exports.customerSyncCode)}\nrequestCustomerSync`,
    {
      flowmark: {
        workflow: (...args) => {
          events.push(["start", ...args])
          return run
        },
      },
      enqueueCustomerSync: async (input) => {
        submissions.push(input)
        if (failure) throw failure
        return job
      },
    },
  )
  return {
    promise: fn("SYNC-2049"),
    events,
    submissions,
    job,
    completion,
  }
}

test("customer sync example preserves the application result and forwards its completion reference", async () => {
  const execution = execute()
  assert.equal(await execution.promise, execution.job)
  assert.equal(execution.submissions.length, 1)
  assert.equal(execution.submissions[0].syncRef, "SYNC-2049")
  assert.equal(execution.submissions[0].completion, execution.completion)
  const [, workflow, options] = execution.events[0]
  assert.equal(workflow, "customer.sync")
  assert.equal(options.correlationId, "SYNC-2049")
  assert.equal(options.properties.integration, "customer-api")
  assert.equal(execution.events[1][1], "customer.sync.completed")
  assert.equal(execution.events[1][2].within, "10m")
  assert.equal(execution.events.at(-1)[1].outcome, "queued")
  assert.equal(execution.events.at(-1)[1].result.accepted, true)
})

test("customer sync example reports the actual returned acceptance, including a negative result", async () => {
  const execution = execute({ accepted: false })
  assert.equal(await execution.promise, execution.job)
  assert.equal(execution.events.at(-1)[0], "done")
  assert.equal(execution.events.at(-1)[1].outcome, "rejected")
  assert.equal(execution.events.at(-1)[1].result.accepted, false)
})

test("customer sync example rethrows the original submission error and never reports completion", async () => {
  const cause = new Error("application submission failed")
  const execution = execute({ failure: cause })
  await assert.rejects(execution.promise, (error) => error === cause)
  assert.equal(execution.submissions.length, 1)
  assert.equal(execution.events.at(-1)[0], "fail")
  assert.equal(execution.events.at(-1)[1].code, "SYNC_QUEUE_FAILED")
  assert.ok(!execution.events.some(([kind]) => kind === "done"))
})
