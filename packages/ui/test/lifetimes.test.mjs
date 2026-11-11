import { setImmediate } from "node:timers"
import assert from "node:assert/strict"
import { test, vi } from "vitest"
import { clipboardFeedback } from "../src/lifecycle/clipboard-feedback.ts"
import { observePromise } from "../src/lifecycle/observe-promise.ts"
import { loadHighlighter } from "../src/highlighter.tsx"

const flush = () => new Promise((resolve) => setImmediate(resolve))
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

test("clipboard reports success, denied/unavailable API and cancels superseded responses and timers", async () => {
  const writes = [deferred(), deferred()]
  const states = []
  const timers = new Map()
  const owner = clipboardFeedback(
    () => writes.shift().promise,
    (state) => states.push(state),
    {
      set: (f) => {
        const id = Symbol()
        timers.set(id, f)
        return id
      },
      clear: (id) => timers.delete(id),
    },
  )
  const [first, second] = writes
  owner.copy("old")
  await flush()
  owner.copy("new")
  await flush()
  first.resolve()
  await flush()
  assert.equal(states.at(-1), "idle")
  second.resolve()
  await flush()
  assert.equal(states.at(-1), "copied")
  assert.equal(timers.size, 1)
  owner.dispose()
  assert.equal(timers.size, 0)
  const count = states.length
  owner.copy("after teardown")
  assert.equal(states.length, count)
  for (const write of [
    () => Promise.reject(new Error("denied")),
    () => {
      throw new Error("unavailable")
    },
  ]) {
    const interaction = clipboardFeedback(write, (s) => states.push(s))
    interaction.copy("test")
    await flush()
    assert.equal(states.at(-1), "failed")
    interaction.dispose()
  }
})

test("late clipboard completion after disposal cannot report success or install a timer", async () => {
  const pending = deferred(),
    states = []
  const owner = clipboardFeedback(
    () => pending.promise,
    (s) => states.push(s),
  )
  owner.copy("test")
  await flush()
  owner.dispose()
  pending.resolve()
  await flush()
  assert.deepEqual(states, ["idle"])
})

test("async replacement supports valid → failed → valid and suppresses obsolete and unmounted results", async () => {
  const states = [],
    old = deferred()
  const cancelOld = observePromise(
    () => old.promise,
    (v) => states.push(v),
    () => states.push("old error"),
  )
  await flush()
  cancelOld()
  observePromise(
    () => Promise.resolve("valid"),
    (v) => states.push(v),
    () => states.push("failed"),
  )
  await flush()
  observePromise(
    () => Promise.reject(new Error("invalid")),
    (v) => states.push(v),
    () => states.push("failed"),
  )
  await flush()
  observePromise(
    () => Promise.resolve("recovered"),
    (v) => states.push(v),
    () => states.push("failed"),
  )
  await flush()
  old.resolve("obsolete")
  const pending = deferred()
  const dispose = observePromise(
    () => pending.promise,
    (v) => states.push(v),
    () => states.push("unmounted error"),
  )
  await flush()
  dispose()
  pending.reject(new Error("unmounted"))
  await flush()
  assert.deepEqual(states, ["valid", "failed", "recovered"])
})

test("unsupported highlighting keeps plaintext fallback and JSON highlighting preserves content", async () => {
  assert.equal(await loadHighlighter("unrecognized-language"), null)
  const highlighter = await loadHighlighter("json")
  assert.ok(highlighter)
  const lines = highlighter.highlight('{"count":0}').lines
  assert.equal(
    lines
      .flat()
      .map((span) => span.props.children)
      .join(""),
    '{"count":0}',
  )
})

test("immediate cleanup does not start deferred browser work", async () => {
  let started = false
  const dispose = observePromise(
    async () => {
      started = true
    },
    () => {},
    () => {},
  )
  dispose()
  await flush()
  assert.equal(started, false)
})

test("copy → navigation cleanup preserves the browser timer receiver", async () => {
  const clear = vi.spyOn(globalThis, "clearTimeout")
  const owner = clipboardFeedback(
    () => Promise.resolve(),
    () => {},
  )
  try {
    owner.copy("copy before navigation")
    await flush()
    owner.dispose()
    assert.equal(clear.mock.calls.length, 1)
    assert.equal(clear.mock.contexts[0], globalThis)
  } finally {
    owner.dispose()
    clear.mockRestore()
  }
})
