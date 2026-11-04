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
  const booking = { accepted, reference: "SYN-BOOK-RECENT" }
  const confirmation = {
    version: 1,
    workflow: "appointment.book",
    runId: "synthetic-run-id",
    expectationId: "synthetic-confirmation-id",
  }
  const run = {
    expect: (...args) => {
      events.push(["expect", ...args])
      return confirmation
    },
    done: (...args) => events.push(["done", ...args]),
    fail: (...args) => events.push(["fail", ...args]),
  }
  const fn = runInNewContext(
    `${compile(exports.bookingCode)}\nbookAppointment`,
    {
      flowmark: {
        workflow: (...args) => {
          events.push(["start", ...args])
          return run
        },
      },
      submitBooking: async (input) => {
        submissions.push(input)
        if (failure) throw failure
        return booking
      },
    },
  )
  return {
    promise: fn("SYN-REF-2049"),
    events,
    submissions,
    booking,
    confirmation,
  }
}

test("booking example preserves the application result and forwards its confirmation reference", async () => {
  const execution = execute()
  assert.equal(await execution.promise, execution.booking)
  assert.equal(execution.submissions.length, 1)
  assert.equal(execution.submissions[0].referralRef, "SYN-REF-2049")
  assert.equal(execution.submissions[0].confirmation, execution.confirmation)
  const [, workflow, options] = execution.events[0]
  assert.equal(workflow, "appointment.book")
  assert.equal(options.correlationId, "SYN-REF-2049")
  assert.equal(options.properties.customer, "Cedar Health")
  assert.equal(options.properties.integration, "orbit")
  assert.equal(execution.events[1][1], "booking.confirmed")
  assert.equal(execution.events[1][2].within, "20m")
  assert.equal(execution.events.at(-1)[1].outcome, "submitted")
  assert.equal(execution.events.at(-1)[1].result.accepted, true)
})

test("booking example reports the actual returned acceptance, including a negative result", async () => {
  const execution = execute({ accepted: false })
  assert.equal(await execution.promise, execution.booking)
  assert.equal(execution.events.at(-1)[0], "done")
  assert.equal(execution.events.at(-1)[1].outcome, "submitted")
  assert.equal(execution.events.at(-1)[1].result.accepted, false)
})

test("booking example rethrows the original submission error and never reports completion", async () => {
  const cause = new Error("application submission failed")
  const execution = execute({ failure: cause })
  await assert.rejects(execution.promise, (error) => error === cause)
  assert.equal(execution.submissions.length, 1)
  assert.equal(execution.events.at(-1)[0], "fail")
  assert.equal(execution.events.at(-1)[1].code, "BOOKING_FAILED")
  assert.ok(!execution.events.some(([kind]) => kind === "done"))
})
