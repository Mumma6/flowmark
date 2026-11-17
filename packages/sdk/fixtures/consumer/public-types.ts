import {
  createFlowmark,
  type Flow,
  type FlowmarkClient,
} from "@flowmarkdev/node"
import {
  createFlowmark as createNextFlowmark,
  type NextFlowmarkConfig,
} from "@flowmarkdev/node/next"
import { createFlowmark as createBrowserFlowmark } from "@flowmarkdev/node/browser"
import { createFlowmarkReadClient } from "@flowmarkdev/node/read"
import type { WorkflowOutcome } from "@flowmarkdev/core"

const config: NextFlowmarkConfig = {
  onDeliveryHealth: (health) => void health.failed,
}
const next = createNextFlowmark(config)
const node: FlowmarkClient = createFlowmark()
const shared = (flow: Flow) => {
  const outcome: WorkflowOutcome = "partial"
  flow.step("validated")
  flow.operation("save", async () => ({ imported: 8 }))
  flow.done({ outcome, result: { imported: 8, rejected: 2 } })
}
shared(next.workflow("types.next"))
shared(node.workflow("types.node"))
const scoped: Promise<{ stories: number }> = node.workflow(
  "types.scope",
  (flow) => {
    flow.done({ outcome: "partial", result: { stories: 8, rejected: 2 } })
    return { stories: 8 }
  },
)
const nextScoped: Promise<number> = next.workflow(
  "types.next-scope",
  async (flow) => {
    return flow.operation("select", () => 8)
  },
)
void scoped
void nextScoped
void createBrowserFlowmark
void createFlowmarkReadClient
// @ts-expect-error Next owns delivery and exposes no shutdown method.
next.shutdown()
