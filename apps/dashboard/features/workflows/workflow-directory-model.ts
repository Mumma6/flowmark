import { Array, Match, Order, pipe } from "effect"
import type { WorkflowSummary } from "../platform/api-types"
import { workflowFamily } from "./workflow-family"

const ordering = (value: number) => (value < 0 ? -1 : value > 0 ? 1 : 0)

export function filterWorkflows(
  workflows: readonly WorkflowSummary[],
  search: string,
  source: string,
  sort: string,
) {
  return pipe(
    workflows,
    Array.filter(
      (item) =>
        item.name.toLowerCase().includes(search.trim().toLowerCase()) &&
        Match.value(source).pipe(
          Match.when("all", () => true),
          Match.when("browser", () => item.name.startsWith("browser.")),
          Match.orElse(() => !item.name.startsWith("browser.")),
        ),
    ),
    Array.sort(
      Order.make<WorkflowSummary>((a, b) =>
        ordering(
          sort === "volume"
            ? b.runs - a.runs || a.name.localeCompare(b.name)
            : workflowFamily(a.name).localeCompare(workflowFamily(b.name)) ||
                a.name.localeCompare(b.name),
        ),
      ),
    ),
  )
}

export function workflowsNeedingAttention(
  workflows: readonly WorkflowSummary[],
) {
  return pipe(
    workflows,
    Array.sort(
      Order.make<WorkflowSummary>((a, b) =>
        ordering(
          (a.successRate ?? 101) - (b.successRate ?? 101) || b.runs - a.runs,
        ),
      ),
    ),
    Array.take(5),
  )
}
