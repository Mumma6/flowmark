import type { SearchFields } from "@flowmarkdev/core"

export const WORKFLOW_DISCOVERY_CAPABILITIES = {
  reads: ["workflows", "revisions", "searchFields"],
  mutations: [],
  unsupportedFilters: ["environment", "status", "release", "aggregate"],
} as const

export interface WorkflowDiscoveryCapabilities {
  readonly reads: readonly ["workflows", "revisions", "searchFields"]
  readonly mutations: readonly []
  readonly unsupportedFilters: readonly [
    "environment",
    "status",
    "release",
    "aggregate",
  ]
}

export interface WorkflowDiscoveryScope {
  readonly projectId: string
  readonly workflow: string | null
  readonly revision: string | null
  readonly cursor: string | null
  readonly limit: number
}

export interface WorkflowDiscoveryOmissions {
  readonly continued: boolean
  readonly truncatedRecords: number
}

export interface WorkflowDiscoveryQuery {
  readonly cursor?: string
  readonly limit?: number
}

export interface DiscoveredWorkflow {
  readonly name: string
}

export interface WorkflowDiscoveryPage {
  readonly workflows: ReadonlyArray<DiscoveredWorkflow>
  readonly nextCursor: string | null
  readonly limit: number
  readonly total: number
  readonly applied: WorkflowDiscoveryScope
  readonly omissions: WorkflowDiscoveryOmissions
  readonly capabilities: WorkflowDiscoveryCapabilities
}

export interface WorkflowMeaningQuery {
  readonly workflow: string
  readonly revision?: string
  readonly cursor?: string
  readonly limit?: number
}

export interface DiscoveredRevision {
  readonly source?: string | null
  readonly revision: string
  readonly declaration: unknown
  readonly truncated: boolean
  readonly omissions: ReadonlyArray<string>
}

export interface WorkflowMeaningPage {
  readonly searchSources?: Readonly<Record<string, string>>
  readonly workflow: string
  readonly revisions: ReadonlyArray<DiscoveredRevision>
  readonly searchFields: SearchFields
  readonly lookupKeys: ReadonlyArray<string>
  readonly dimensionKeys: ReadonlyArray<string>
  readonly nextCursor: string | null
  readonly limit: number
  readonly totalRevisions: number
  readonly applied: WorkflowDiscoveryScope
  readonly omissions: WorkflowDiscoveryOmissions
  readonly capabilities: WorkflowDiscoveryCapabilities
}
