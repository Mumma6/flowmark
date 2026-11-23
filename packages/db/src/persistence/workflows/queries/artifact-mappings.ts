import type { ArtifactMappingScope } from "@flowmarkdev/core"
import { and, desc, eq } from "drizzle-orm"
import { Effect } from "effect"
import {
  deploymentBindings,
  deploymentReceipts,
} from "../../../schema/index.js"
import { Database } from "../../database.js"
import { DatabaseOperation } from "../../database-operation.js"
import { runQuery } from "../../run-query.js"

export const artifactMappings = Effect.fn("artifactMappings")(function* (
  projectId: string,
  scope: ArtifactMappingScope,
) {
  const db = yield* Database
  const limit = 12
  const rows = yield* runQuery(DatabaseOperation.ListRuns, () =>
    db
      .select({
        bindingId: deploymentBindings.id,
        deploymentId: deploymentReceipts.deploymentId,
        service: deploymentBindings.service,
        environment: deploymentBindings.environment,
        manifestDigest: deploymentReceipts.manifestDigest,
        manifest: deploymentReceipts.manifest,
        receivedAt: deploymentReceipts.receivedAt,
      })
      .from(deploymentBindings)
      .innerJoin(
        deploymentReceipts,
        and(
          eq(deploymentReceipts.projectId, deploymentBindings.projectId),
          eq(deploymentReceipts.bindingId, deploymentBindings.id),
        ),
      )
      .where(
        and(
          eq(deploymentBindings.projectId, projectId),
          eq(deploymentBindings.repository, scope.repository),
          scope.receipt && eq(deploymentBindings.id, scope.receipt.bindingId),
          scope.receipt &&
            eq(deploymentReceipts.deploymentId, scope.receipt.deploymentId),
          scope.environment === undefined
            ? undefined
            : eq(deploymentBindings.environment, scope.environment),
        ),
      )
      .orderBy(
        desc(deploymentReceipts.receivedAt),
        desc(deploymentBindings.id),
        desc(deploymentReceipts.deploymentId),
      )
      .limit(limit + 1),
  )
  return {
    mappings: rows
      .slice(0, limit)
      .map((row) => ({ ...row, receivedAt: row.receivedAt.toISOString() })),
    truncated: rows.length > limit,
  }
})
