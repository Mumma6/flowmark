import type { FlowmarkClient } from "@flowmark/node"

export const scenarioIds = [
  "lifecycle",
  "context",
  "handled-error",
  "terminal-failure",
  "operations",
  "operation-failure",
  "deferred-completion",
  "progress",
  "correlation",
] as const

export type ScenarioId = (typeof scenarioIds)[number]

export const scenarios: {
  id: ScenarioId
  group: string
  title: string
  methods: string
  expected: string
}[] = [
  {
    id: "lifecycle",
    group: "Runs and data",
    title: "Basic lifecycle",
    methods: "workflow → step → done · runId",
    expected: "Completed run with one milestone. Later markers are ignored.",
  },
  {
    id: "context",
    group: "Runs and data",
    title: "Context and business result",
    methods: "properties · setProperties · step(properties) · done(result)",
    expected:
      "Run context changes from pending to saved. Step data stays local to the milestone.",
  },
  {
    id: "handled-error",
    group: "Errors",
    title: "Recover from an error",
    methods: "error({ handled: true }) → done",
    expected: "Completed run containing a handled error; no failed workflow.",
  },
  {
    id: "terminal-failure",
    group: "Errors",
    title: "Terminal failure",
    methods: "fail({ code, message, retryable })",
    expected: "Failed run. Later done() must not change its status.",
  },
  {
    id: "operations",
    group: "Operations and progress",
    title: "Manual and callback operations",
    methods: "operation(name) · operation(name, callback)",
    expected: "Two operations with distinct IDs and measured durations.",
  },
  {
    id: "operation-failure",
    group: "Operations and progress",
    title: "Operation callback rejection",
    methods: "operation(callback) rejection → error → done",
    expected:
      "Failed operation, original application error caught, workflow Completed.",
  },
  {
    id: "deferred-completion",
    group: "Operations and progress",
    title: "Complete with operations still open",
    methods: "operation × 2 → done(result) → operation.done",
    expected:
      "Completion appears after both operations close, preserving the first result.",
  },
  {
    id: "progress",
    group: "Operations and progress",
    title: "Absolute progress snapshots",
    methods: "progress({ completed, total, unit })",
    expected:
      "Snapshots 0/3, 1/3, 2/3, 3/3 rows. These are absolute values, not increments.",
  },
  {
    id: "correlation",
    group: "Related runs",
    title: "Parent and correlated child",
    methods: "runId · correlationId · parentRunId",
    expected:
      "Two independently completed runs linked in the dashboard. No automatic tracing.",
  },
]

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 80))

/** Each case is deliberately small: this module is the editable SDK test catalog. */
export async function runScenario(
  client: Pick<FlowmarkClient, "workflow">,
  id: ScenarioId,
  source: "browser" | "next" | "node",
) {
  const name = `${source === "browser" ? "browser." : ""}sdk.${source}.${id}`
  const correlationId = crypto.randomUUID()
  const flow = client.workflow(name, {
    environment: "local",
    release: "sdk-playground",
    correlationId,
    properties: { scenario: id, source },
  })
  const runs = [{ runId: flow.runId, name }]

  switch (id) {
    case "lifecycle": {
      flow.step("checkpoint")
      flow.done()
      flow.step("ignored-after-done")
      break
    }
    case "context": {
      flow.setProperties({ state: "pending", count: 1 })
      flow.step("record-saved", { properties: { storage: "simulated" } })
      flow.setProperties({ state: "saved", count: 2 })
      flow.done({ result: { saved: 2 } })
      break
    }
    case "handled-error": {
      flow.error({
        code: "SIMULATED_TIMEOUT",
        message: "Expected test error; fallback succeeds.",
        handled: true,
        retryable: true,
      })
      flow.step("fallback-used")
      flow.done({ result: { provider: "fallback" } })
      break
    }
    case "terminal-failure": {
      flow.fail({
        code: "SIMULATED_FAILURE",
        message: "Intentional SDK test failure.",
        retryable: false,
      })
      flow.done()
      break
    }
    case "operations": {
      const operation = flow.operation("manual-work")
      await pause()
      operation.done()
      await flow.operation("callback-work", pause)
      flow.done({ result: { operations: 2 } })
      break
    }
    case "operation-failure": {
      const expected = new Error("Intentional callback rejection")
      try {
        await flow.operation("rejecting-work", async () => {
          throw expected
        })
      } catch (cause) {
        if (cause !== expected) {
          throw cause
        }
        flow.error({
          code: "CALLBACK_CAUGHT",
          message: expected.message,
          handled: true,
        })
      }
      flow.done({ result: { originalErrorPreserved: true } })
      break
    }
    case "deferred-completion": {
      const first = flow.operation("first")
      const second = flow.operation("second")
      flow.done({ result: { deferred: true } })
      await pause()
      second.done()
      await pause()
      first.done()
      break
    }
    case "progress": {
      for (let completed = 0; completed <= 3; completed += 1) {
        flow.progress({ completed, total: 3, unit: "rows" })
        await pause()
      }
      flow.done({ result: { processed: 3 } })
      break
    }
    case "correlation": {
      const childName = `${name}.child`
      const child = client.workflow(childName, {
        correlationId,
        parentRunId: flow.runId,
        properties: { scenario: id, source },
      })
      child.step("child-work")
      child.done({ result: { child: true } })
      flow.done({ result: { parent: true } })
      runs.push({ runId: child.runId, name: childName })
      break
    }
  }
  return { runs, correlationId }
}
