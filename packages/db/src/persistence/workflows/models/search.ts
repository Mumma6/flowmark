import type { RunStatus } from "./runs.js"

export type ProjectSearchWorkflow = {
  readonly name: string
}

export type ProjectSearchRun = {
  readonly id: string
  readonly externalId: string
  readonly workflow: string
  readonly status: RunStatus
  readonly startedAt: string
  readonly failCode: string | null
}

export type ProjectSearchReference = {
  readonly runId: string
  readonly externalId: string
  readonly workflow: string
  readonly key: string
  readonly value: string
}

export type ProjectSearch = {
  readonly workflows: ReadonlyArray<ProjectSearchWorkflow>
  readonly runs: ReadonlyArray<ProjectSearchRun>
  readonly references: ReadonlyArray<ProjectSearchReference>
}
