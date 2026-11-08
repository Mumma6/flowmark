import { expect, it } from "vitest"
import { Option } from "effect"
import type { RunEvent } from "../features/platform/api-types"
import {
  connectedFailureCalls,
  connectedInsightCalls,
  connectedRunCalls,
} from "../features/runs/connected-retrieval"
import { explorerDefaults } from "../features/runs/explorer-filters"
import { buildSafeRunContextHandoff } from "../features/runs/safe-run-context-handoff"

const projectId = "11111111-1111-4111-8111-111111111111"
const runId = "22222222-2222-4222-8222-222222222222"
const windows = {
  currentStartedAfter: "2026-10-08T00:00:00.000Z",
  currentStartedBefore: "2026-10-15T00:00:00.000Z",
  previousStartedAfter: "2026-10-01T00:00:00.000Z",
  previousStartedBefore: "2026-10-08T00:00:00.000Z",
}

const event = (type: RunEvent["type"]): RunEvent =>
  ({
    id: type,
    type,
    workflow: "orders.import",
    externalId: "execution-1",
    timestamp: "2026-10-01T00:00:00.000Z",
  }) as RunEvent

it("keeps a non-uuid run off get_run instead of widening it", () => {
  expect(connectedRunCalls("proj-1", "execution-1")).toEqual([])
  const preview = Option.getOrThrow(
    buildSafeRunContextHandoff(
      [event("started")],
      {
        projectId: "proj-1",
        projectName: "Billing",
        runPath: "https://studio.test/runs/execution-1",
        sourceFrom: null,
        filters: explorerDefaults,
      },
      "https://studio.test",
      { mode: "connected", calls: [] },
    ),
  )
  expect(preview.preview).toContain("Supported tool query: none")
  expect(preview.preview).not.toContain("get_run")
  expect(preview.preview).not.toContain("FLOWMARK_API_KEY")
})

it("reproduces get_run from the version-1 run selection", () => {
  const calls = connectedRunCalls(projectId, runId)
  expect(calls).toEqual([
    {
      tool: "get_run",
      input: {
        projectId,
        runId,
        section: "events",
        cursor: undefined,
        limit: undefined,
      },
    },
  ])
  expect(JSON.stringify(calls[0]?.input)).not.toContain("environment")
})

it("reproduces the technical cohort and the failed-run page without a second window", () => {
  const calls = connectedFailureCalls({
    projectId,
    workflow: "orders.import",
    code: "UPSTREAM_TIMEOUT",
    ...windows,
  })
  expect(calls.map((call) => call.tool)).toEqual([
    "get_workflow_insights",
    "find_runs",
  ])
  expect(calls[0]?.input).toMatchObject({
    mode: "technical",
    workflow: "orders.import",
    ...windows,
  })
  expect(calls[0]?.input).not.toHaveProperty("revision")
  expect(calls[0]?.input).not.toHaveProperty("environment")
  expect(calls[1]?.input).toMatchObject({
    startedAfter: windows.currentStartedAfter,
    startedBefore: windows.currentStartedBefore,
    status: "Failed",
    failCode: "UPSTREAM_TIMEOUT",
  })
  expect(calls[1]?.input).not.toHaveProperty("search")
})

it("withholds a business tool call when the window or dimension is incomplete", () => {
  expect(
    connectedInsightCalls({
      projectId,
      validDates: false,
      query: {
        workflow: "orders.import",
        revision: "booked",
        path: ["status"],
        ...windows,
      },
    }),
  ).toEqual([])
  expect(
    connectedInsightCalls({
      projectId,
      validDates: true,
      query: {
        workflow: "orders.import",
        revision: "booked",
        path: ["status"],
        businessKey: "customerId",
        ...windows,
      },
    }),
  ).toEqual([])
})

it("keeps a selected dimension value inside the business tool arguments", () => {
  const calls = connectedInsightCalls({
    projectId,
    validDates: true,
    query: {
      workflow: "orders.import",
      revision: "booked",
      path: ["status"],
      businessKey: "customerId",
      businessValue: "cust-secret",
      ...windows,
    },
  })
  expect(calls).toHaveLength(1)
  expect(calls[0]?.input).toMatchObject({
    mode: "business",
    businessKey: "customerId",
    businessValue: "cust-secret",
    revision: "booked",
  })
  expect(calls[0]?.input).not.toHaveProperty("environment")
})

it("preserves a linked section, limit and cursor in the actual tool handoff", () => {
  const selection = {
    version: 1,
    kind: "run",
    projectId,
    runId,
    section: "expectations",
    cursor: "next-page",
    limit: 7,
  }
  expect(
    connectedRunCalls(projectId, runId, JSON.stringify(selection)),
  ).toEqual([
    {
      tool: "get_run",
      input: {
        projectId,
        runId,
        section: "expectations",
        cursor: "next-page",
        limit: 7,
      },
    },
  ])
  expect(
    connectedRunCalls(
      projectId,
      runId,
      JSON.stringify({ ...selection, projectId: runId }),
    ),
  ).toEqual([])
  expect(connectedRunCalls(projectId, runId, "{damaged")).toEqual([])
})

it("does not partially replace an invalid failure selection with a broader call", () => {
  expect(
    connectedFailureCalls({
      projectId,
      workflow: "orders.import",
      code: "TIMEOUT",
      ...windows,
      previousStartedBefore: "invalid",
    }),
  ).toEqual([])
})
