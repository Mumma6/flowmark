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
      new URL("../app/components/code-examples.ts", import.meta.url),
      "utf8",
    ),
  ),
  { exports },
)
const { examples } = exports
const functions = {
  checkout: "checkoutOrder",
  sync: "syncRecords",
  job: "runNightlyJob",
}

function execute(example, code, failure) {
  const events = []
  const businessCalls = []
  const result = { succeeded: 988, failed: 12 }
  const shipment = { id: "shipment-001" }
  const run = {
    step: (...args) => events.push(["step", ...args]),
    progress: (...args) => events.push(["progress", ...args]),
    done: (...args) => events.push(["done", ...args]),
    fail: (...args) => events.push(["fail", ...args]),
  }
  const context = {
    flowmark: {
      workflow: (...args) => {
        events.push(["started", ...args])
        return run
      },
    },
    logger: {
      error: (data, message) =>
        businessCalls.push(["log", { ...data }, message]),
    },
    loadWork: async () => {
      businessCalls.push("load")
      return Array(1000).fill({})
    },
    processWork: async () => {
      businessCalls.push("process")
      if (failure) throw failure
      return result
    },
    countRecords: async () => 1000,
    fetchRecordPages: async function* () {
      yield Array(300).fill({})
      yield Array(300).fill({})
      if (failure) throw failure
    },
    updateRecords: async (page) => businessCalls.push(["update", page.length]),
    capturePayment: async () => businessCalls.push("payment"),
    createShipment: async () => {
      businessCalls.push("shipment")
      if (failure) throw failure
      return shipment
    },
  }
  const fn = runInNewContext(
    `${compile(code)}\n${functions[example.id]}`,
    context,
  )
  return { promise: fn("sample-001"), events, businessCalls, result, shipment }
}

for (const example of examples) {
  test(`${example.label}: small instrumentation budget and inspectable evidence`, () => {
    const before = example.existingCode.split("\n").length
    const after = example.code.split("\n").length
    assert.ok(after - before <= 7, `Added ${after - before} lines`)
    assert.ok(after <= 18, `Example is ${after} lines long`)
    assert.ok(example.preview.events.every((event) => event.detail.length > 0))
    assert.equal(
      new Set(example.preview.events.map((event) => event.id)).size,
      example.preview.events.length,
    )
  })

  test(`${example.label}: preserves business result and calls`, async () => {
    const before = execute(example, example.existingCode)
    const after = execute(example, example.code)
    const [original, instrumented] = await Promise.all([
      before.promise,
      after.promise,
    ])
    assert.deepEqual(instrumented, original)
    assert.deepEqual(after.businessCalls, before.businessCalls)
    assert.equal(after.events.at(-1)[0], "done")
    if (example.id === "job") assert.equal(instrumented, after.result)
    if (example.id === "checkout") assert.equal(instrumented, after.shipment)
  })

  test(`${example.label}: preserves original error and logging`, async () => {
    const cause = new Error("application failure")
    const before = execute(example, example.existingCode, cause)
    const after = execute(example, example.code, cause)
    await Promise.all([
      assert.rejects(before.promise, (error) => error === cause),
      assert.rejects(after.promise, (error) => error === cause),
    ])
    assert.deepEqual(after.businessCalls, before.businessCalls)
    assert.equal(after.events.at(-1)[0], "fail")
    assert.ok(!after.events.some(([type]) => type === "done"))
    if (example.id === "sync") {
      assert.equal(
        after.events.filter(([type]) => type === "progress").at(-1)[1]
          .completed,
        600,
      )
    }
  })
}
