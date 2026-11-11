import type { RunStatus } from "./runs.js"

export interface ProjectSearchWorkflow {
  readonly name: string
}

export interface ProjectSearchRun {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly status: RunStatus
  readonly startedAt: string
  readonly failCode: string | null
}

export interface ProjectSearchReference {
  readonly runId: string
  readonly externalId: string
  readonly workflow: string
  readonly key: string
  readonly value: string
}

export interface ProjectSearch {
  readonly workflows: ReadonlyArray<ProjectSearchWorkflow>
  readonly runs: ReadonlyArray<ProjectSearchRun>
  readonly references: ReadonlyArray<ProjectSearchReference>
}
