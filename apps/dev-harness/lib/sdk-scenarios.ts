import type { FlowmarkClient } from "@flowmarkdev/node"
import { Effect } from "effect"
import type { ScenarioId } from "./sdk-scenario-catalog"
export { scenarios, scenarioIds, type ScenarioId } from "./sdk-scenario-catalog"
type Client = Pick<FlowmarkClient, "workflow">
type Run = { readonly runId: string; readonly name: string }
type ScenarioContext = {
  readonly flow: ReturnType<Client["workflow"]>
  readonly client: Client
  readonly name: string
  readonly correlationId: string
  readonly id: ScenarioId
  readonly source: "browser" | "next" | "node"
}
type Handler = (context: ScenarioContext) => Promise<readonly Run[]>
const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 80))
const handlers = {
  lifecycle: async ({ flow }) => {
    flow.step("checkpoint")
    flow.done()
    flow.step("ignored-after-done")
    return []
  },
  context: async ({ flow }) => {
    flow.setProperties({ state: "pending", count: 1 })
    flow.step("record-saved", { properties: { storage: "simulated" } })
    flow.setProperties({ state: "saved", count: 2 })
    flow.done({ result: { saved: 2 } })
    return []
  },
  "handled-error": async ({ flow }) => {
    flow.error({
      code: "SIMULATED_TIMEOUT",
      message: "Expected test error; fallback succeeds.",
      handled: true,
      retryable: true,
    })
    flow.step("fallback-used")
    flow.done({ result: { provider: "fallback" } })
    return []
  },
  "terminal-failure": async ({ flow }) => {
    flow.fail({
      code: "SIMULATED_FAILURE",
      message: "Intentional SDK test failure.",
      retryable: false,
    })
    flow.done()
    return []
  },
  operations: async ({ flow }) => {
    const operation = flow.operation("manual-work")
    await pause()
    operation.done()
    await flow.operation("callback-work", pause)
    flow.done({ result: { operations: 2 } })
    return []
  },
  "operation-failure": async ({ flow }) => {
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
    return []
  },
  "deferred-completion": async ({ flow }) => {
    const first = flow.operation("first")
    const second = flow.operation("second")
    flow.done({ result: { deferred: true } })
    await pause()
    second.done()
    await pause()
    first.done()
    return []
  },
  progress: async ({ flow }) => {
    await Effect.runPromise(
      Effect.forEach(
        [0, 1, 2, 3],
        (completed) =>
          Effect.sync(() =>
            flow.progress({ completed, total: 3, unit: "rows" }),
          ).pipe(Effect.andThen(Effect.sleep(80))),
        { concurrency: 1, discard: true },
      ),
    )
    flow.done({ result: { processed: 3 } })
    return []
  },
  correlation: async ({ flow, client, name, correlationId, id, source }) => {
    const childName = `${name}.child`
    const child = client.workflow(childName, {
      correlationId,
      parentRunId: flow.runId,
      properties: { scenario: id, source },
    })
    child.step("child-work")
    child.done({ result: { child: true } })
    flow.done({ result: { parent: true } })
    return [{ runId: child.runId, name: childName }]
  },
  continue: async ({ flow, client, name, correlationId, id, source }) => {
    flow.step("draft-started")
    const later = client.workflow(name, {
      id: flow.runId,
      environment: "local",
      release: "sdk-playground",
      correlationId,
      properties: { scenario: id, source, wave: 2 },
    })
    later.step("battle-claimed")
    later.done({ result: { continued: true } })
    return []
  },
} satisfies Record<ScenarioId, Handler>
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
  const related = await handlers[id]({
    flow,
    client,
    name,
    correlationId,
    id,
    source,
  })
  return { runs: [{ runId: flow.runId, name }, ...related], correlationId }
}
