export type McpListWorkflowsResult = {
  readonly tool: "list_workflows"
  readonly projectId: string
  readonly discovery: unknown
  readonly meaning?: unknown
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
