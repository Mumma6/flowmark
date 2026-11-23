import {
  boundariesFromArtifactMappings,
  reconcileEvidenceBoundaries,
  type DeployedBoundary,
  type SourceBoundary,
} from "@flowmarkdev/core"
import { Effect } from "effect"
import type { PersistenceError } from "../../../errors.js"
import type { ProjectReader } from "../models/project-reader.js"
import { GetProjectWorkflowData } from "./get-project-workflow-data.js"

export const discoverEvidenceBoundaries = Effect.fn(
  "discoverEvidenceBoundaries",
)(function* (
  reader: ProjectReader,
  input: {
    readonly repository: string
    readonly environment?: string
    readonly source: readonly SourceBoundary[]
    readonly previous?: readonly SourceBoundary[]
    readonly independentInventory: readonly DeployedBoundary[]
  },
) {
  const reads = yield* GetProjectWorkflowData
  const inventory = yield* reads.artifactMappings(reader, {
    repository: input.repository,
    environment: input.environment,
  })
  return {
    ...reconcileEvidenceBoundaries({
      source: input.source,
      deployed: [
        ...boundariesFromArtifactMappings(inventory.mappings),
        ...input.independentInventory,
      ],
      previous: input.previous,
    }),
    deploymentInventoryTruncated: inventory.truncated,
  }
})

export type DiscoverEvidenceBoundariesError = PersistenceError
