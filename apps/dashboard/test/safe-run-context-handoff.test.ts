import { Option } from "effect"
import { expect, it } from "vitest"
import type { RunEvent } from "../features/platform/api-types"
import { explorerDefaults } from "../features/runs/explorer-filters"
import {
  connectedFailureCalls,
  connectedInsightCalls,
  separateObservationNotice,
} from "../features/runs/connected-retrieval"
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
  expect(preview.preview).toContain(separateObservationNotice)
  expect(preview.omissions.join("\n")).toContain("Failure message text")
})

it("keeps a rejected selection explicit without dropping the page filters", () => {
  const preview = Option.getOrThrow(
    buildSafeRunContextHandoff(
      [event("started")],
      {
        projectId: "proj-1",
        projectName: "Billing",
        runPath: "https://studio.test/runs/run-1",
        sourceFrom: "/?workflow=orders.import",
        filters: { ...explorerDefaults, workflow: "orders.import" },
        selectionNote:
          "This link names a different project. It does not switch projects or widen the query.",
      },
      "https://studio.test",
      { mode: "connected", calls: [] },
    ),
  )
  expect(preview.preview).toContain("Selection not applied:")
  expect(preview.preview).toContain("does not switch projects")
  expect(preview.preview).toContain("orders.import")
  expect(preview.preview).toContain("Supported tool query: none")
  expect(preview.preview).toContain(separateObservationNotice)
  expect(preview.preview).not.toContain("get_run")
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
  expect(handoff.preview).toContain(separateObservationNotice)
})

it("states that an empty failure code is not widened into find_runs", () => {
  const input = {
    projectId: "11111111-1111-4111-8111-111111111111",
    projectName: "Billing",
    sourcePath: "/issues?days=7",
    currentStartedAfter: "2026-10-08T00:00:00.000Z",
    currentStartedBefore: "2026-10-15T00:00:00.000Z",
    previousStartedAfter: "2026-10-01T00:00:00.000Z",
    previousStartedBefore: "2026-10-08T00:00:00.000Z",
    workflow: "orders.import",
    code: "",
    currentCount: 2,
    previousCount: 1,
    countDelta: 1,
    matchingRunsPath: "/runs?status=Failed&workflow=orders.import",
    truncated: false,
  }
  const calls = connectedFailureCalls(input)
  const handoff = buildSafeFailureGroupHandoff(input, "https://studio.test", {
    mode: "connected",
    calls,
  })
  expect(calls.map((call) => call.tool)).toEqual(["get_workflow_insights"])
  expect(handoff.preview).toContain("No failure code was recorded")
  expect(handoff.preview).toContain("wider than this group")
  expect(handoff.preview).not.toContain("Tool: find_runs")
  expect(handoff.preview).toContain("2026-10-08T00:00:00.000Z")
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
  expect(handoff.preview).toContain("2026-10-01T00:00:00.000Z")
})

it("keeps an incomplete business selection explicit when no tool call is issued", () => {
  const query = {
    workflow: "orders.import",
    revision: "v2",
    path: ["count"],
    currentStartedAfter: "2026-10-01T00:00:00.000Z",
    currentStartedBefore: "2026-10-08T00:00:00.000Z",
    previousStartedAfter: "2026-09-24T00:00:00.000Z",
    previousStartedBefore: "2026-10-01T00:00:00.000Z",
    businessKey: "customerId",
    numerator: ["accepted"],
    releaseA: "2026.10",
    releaseB: "2026.10",
  }
  const calls = connectedInsightCalls({
    projectId: "11111111-1111-4111-8111-111111111111",
    validDates: true,
    query,
  })
  const handoff = buildSafeInsightHandoff(
    {
      projectId: "11111111-1111-4111-8111-111111111111",
      projectName: "Billing",
      sourcePath: "/insights?revision=v2",
      workflow: "orders.import",
      validDates: true,
      revision: "v2",
      fieldLabel: "Successful imports",
      input: query,
      releaseComparison: {
        available: false,
        reason: "Not enough release observations",
        minimumRuns: 5,
      },
      limitations: [],
    },
    "https://studio.test",
    { mode: "connected", calls },
  )
  expect(calls).toEqual([])
  expect(handoff.preview).toContain("value was not supplied")
  expect(handoff.preview).toContain("Ratio selection is one-sided")
  expect(handoff.preview).toContain("same release twice")
  expect(handoff.preview).toContain("Supported tool query: none")
  expect(handoff.preview).not.toContain("value is only in the tool arguments")
  expect(handoff.preview).toContain("Definition revision: v2")
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
