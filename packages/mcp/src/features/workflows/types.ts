export type McpListWorkflowsResult = {
  readonly tool: "list_workflows"
  readonly projectId: string
  readonly discovery: unknown
  readonly meaning?: unknown
}

export type McpGetRunSection =
  "events" | "related" | "expectations" | "operations"

export type McpGetRunResult = {
  readonly tool: "get_run"
  readonly projectId: string
  readonly runId: string
  readonly summary: unknown
  readonly section: McpGetRunSection
  readonly page: unknown
  readonly nextCursor: string | null
  readonly availableSections: readonly McpGetRunSection[]
  readonly distinctions: {
    readonly runStatus: string
    readonly durationMs: string
    readonly operationStatus: string
  }
}

export type McpCompareRunResult = {
  readonly tool: "compare_run"
  readonly projectId: string
  readonly runId: string
  readonly selection: unknown
  readonly comparison: unknown
  readonly distinctions: {
    readonly peerDuration: string
    readonly operationDuration: string
    readonly operationStatus: string
  }
}

export type McpFindRunsResult = {
  readonly tool: "find_runs"
  readonly projectId: string
  readonly appliedWindow: {
    readonly startedAfter: string
    readonly startedBefore: string
  }
  readonly page: unknown
  readonly idFields: {
    readonly runId: string
    readonly externalId: string
  }
}
