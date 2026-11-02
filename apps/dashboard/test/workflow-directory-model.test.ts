import { expect, it } from "vitest"
import {
  filterWorkflows,
  workflowsNeedingAttention,
} from "../features/workflows/workflow-directory-model"
import type { WorkflowSummary } from "../lib/api/types"

const workflow = (
  name: string,
  runs: number,
  successRate: number | null,
): WorkflowSummary => ({ name, runs, successRate }) as WorkflowSummary
it("keeps browser namespaces separate and orders by family or volume without mutating input", () => {
  const workflows = [
    workflow("orders.sync", 10, 100),
    workflow("browser.orders.sync", 20, null),
    workflow("invoices.import", 5, 50),
  ]
  expect(
    filterWorkflows(workflows, " ORDERS ", "server", "name").map(
      (item) => item.name,
    ),
  ).toEqual(["orders.sync"])
  expect(
    filterWorkflows(workflows, "", "browser", "volume").map(
      (item) => item.name,
    ),
  ).toEqual(["browser.orders.sync"])
  expect(
    filterWorkflows(workflows, "", "all", "name").map((item) => item.name),
  ).toEqual(["invoices.import", "browser.orders.sync", "orders.sync"])
  expect(workflows[0].name).toBe("orders.sync")
})
it("orders recorded completion ahead of unknown completion, with volume breaking ties", () => {
  const workflows = [
    workflow("unknown", 100, null),
    workflow("complete", 1, 100),
    workflow("a", 10, 50),
    workflow("b", 20, 50),
  ]
  expect(workflowsNeedingAttention(workflows).map((item) => item.name)).toEqual(
    ["b", "a", "complete", "unknown"],
  )
})
