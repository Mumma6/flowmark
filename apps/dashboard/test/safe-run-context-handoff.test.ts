import { Option } from "effect"
import { expect, it } from "vitest"
import type { RunEvent } from "../features/platform/api-types"
import { explorerDefaults } from "../features/runs/explorer-filters"
import {
  buildSafeFailureGroupHandoff,
  buildSafeInsightHandoff,
  buildSafeRunContextHandoff,
  summarizeSourceSelection,
} from "../features/runs/safe-run-context-handoff"

const event = (
  type: RunEvent["type"],
  extra: Partial<RunEvent> = {},
): RunEvent =>
  ({
    id: type,
    type,
    workflow: "orders.import",
    externalId: "execution-1",
    timestamp: "2026-10-01T00:00:00Z",
    ...extra,
  }) as RunEvent

it("redacts business reference values and search text from source selection", () => {
  const summary = summarizeSourceSelection(
    {
      ...explorerDefaults,
      workflow: "orders.import",
      businessKey: "customerId",
      businessValue: "cust-secret-1",
      search: "invoice-99",
      startedAfter: "2026-10-01",
      startedBefore: "2026-10-07",
    },
    "/?workflow=orders.import",
    "https://studio.test",
  )
  expect(summary.filterLines.join("\n")).toContain("customerId")
  expect(summary.filterLines.join("\n")).not.toContain("cust-secret-1")
  expect(summary.filterLines.join("\n")).not.toContain("invoice-99")
  expect(summary.omissions).toContain(
    "Business reference value from source selection",
  )
  expect(summary.omissions).toContain(
    "Explore search text from source selection",
  )
  expect(summary.utcWindow).toContain("2026-10-01T00:00:00.000Z")
})

it("builds a safe preview without raw payloads or failure message text", () => {
  const preview = Option.getOrThrow(
    buildSafeRunContextHandoff(
      [
        event("started", { environment: "staging" }),
        event("failed", {
          error: { code: "UPSTREAM_TIMEOUT", message: "Sensitive detail" },
          outcome: "partial",
          result: { customerId: "hidden" },
        }),
      ],
      {
        projectId: "proj-1",
        projectName: "Billing",
        runPath: "https://studio.test/runs/run-1",
        sourceFrom: "/runs",
        filters: explorerDefaults,
      },
      "https://studio.test",
    ),
  )
  expect(preview.preview).toContain("Project: Billing (id: proj-1)")
  expect(preview.preview).toContain("Failure code: UPSTREAM_TIMEOUT")
  expect(preview.preview).not.toContain("Sensitive detail")
  expect(preview.preview).not.toContain("hidden")
  expect(preview.preview).not.toContain("FLOWMARK_API_KEY")
  expect(preview.preview).toContain("unavailable Flowmark tools")
  expect(preview.omissions.join("\n")).toContain("Failure message text")
})

it("builds failure group handoff with exact cohort bounds and no issue id", () => {
  const handoff = buildSafeFailureGroupHandoff(
    {
      projectId: "proj-1",
      projectName: "Billing",
      sourcePath: "/issues?days=30",
      currentStartedAfter: "2026-10-01T00:00:00.000Z",
      currentStartedBefore: "2026-10-08T00:00:00.000Z",
      previousStartedAfter: "2026-09-24T00:00:00.000Z",
      previousStartedBefore: "2026-10-01T00:00:00.000Z",
      workflow: "orders.import",
      code: "UPSTREAM_TIMEOUT",
      currentCount: 12,
      previousCount: 3,
      countDelta: 9,
      matchingRunsPath:
        "/runs?status=Failed&startedAfterExact=2026-10-01T00:00:00.000Z&startedBeforeExclusive=2026-10-08T00:00:00.000Z&workflow=orders.import&failCode=UPSTREAM_TIMEOUT",
      truncated: false,
    },
    "https://studio.test",
  )
  expect(handoff.preview).toContain("persistent issue ID")
  expect(handoff.preview).toContain("UPSTREAM_TIMEOUT")
  expect(handoff.preview).toContain("startedAfter: 2026-10-01T00:00:00.000Z")
  expect(handoff.preview).not.toContain("cust-secret")
})

it("builds insight handoff without dimension values and notes unsupported windows", () => {
  const handoff = buildSafeInsightHandoff(
    {
      projectId: "proj-1",
      projectName: "Billing",
      sourcePath: "/insights?biPath=%5B%22count%22%5D",
      workflow: "orders.import",
      validDates: false,
      revision: "v2",
      fieldLabel: "Successful imports",
      input: {
        workflow: "orders.import",
        revision: "v2",
        path: ["count"],
        currentStartedAfter: "2026-10-01T00:00:00.000Z",
        currentStartedBefore: "2026-10-08T00:00:00.000Z",
        previousStartedAfter: "2026-09-24T00:00:00.000Z",
        previousStartedBefore: "2026-10-01T00:00:00.000Z",
        businessKey: "customerId",
        businessValue: "cust-secret",
      },
      releaseComparison: {
        available: false,
        reason: "Not enough release observations",
        minimumRuns: 5,
      },
      limitations: ["Not enough release observations"],
    },
    "https://studio.test",
  )
  expect(handoff.preview).toContain("not supported")
  expect(handoff.preview).toContain("customerId (value omitted")
  expect(handoff.preview).not.toContain("cust-secret")
  expect(handoff.omissions.join("\n")).toContain("Declared dimension value")
})

it("returns none when the run has no events", () => {
  expect(
    Option.isNone(
      buildSafeRunContextHandoff(
        [],
        {
          projectId: "proj-1",
          projectName: "Billing",
          runPath: "https://studio.test/runs/run-1",
          sourceFrom: null,
          filters: explorerDefaults,
        },
        "https://studio.test",
      ),
    ),
  ).toBe(true)
})
