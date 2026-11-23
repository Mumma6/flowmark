import { and, eq } from "drizzle-orm"
import { Effect } from "effect"
import type {
  RuntimeObservationBinding,
  RuntimeProbeReference,
} from "@flowmarkdev/core"
import {
  deploymentBindings,
  deploymentReceipts,
} from "../../../schema/index.js"
import { DatabaseOperation } from "../../database-operation.js"
import type { DatabaseTransaction } from "../../run-transaction.js"
import { runQuery } from "../../run-query.js"

export const resolveRuntimeProbe = Effect.fn("resolveRuntimeProbe")(function* (
  tx: DatabaseTransaction,
  projectId: string,
  reportedEnvironment: string | null,
  reference: RuntimeProbeReference | undefined,
) {
  const unknown = { status: "unknown" } satisfies RuntimeObservationBinding
  if (!reference) {
    return unknown
  }
  const [receipt] = yield* runQuery(DatabaseOperation.AppendEvent, () =>
    tx
      .select({
        environment: deploymentBindings.environment,
        manifest: deploymentReceipts.manifest,
        manifestDigest: deploymentReceipts.manifestDigest,
      })
      .from(deploymentReceipts)
      .innerJoin(
        deploymentBindings,
        and(
          eq(deploymentBindings.id, deploymentReceipts.bindingId),
          eq(deploymentBindings.projectId, deploymentReceipts.projectId),
        ),
      )
      .where(
        and(
          eq(deploymentReceipts.projectId, projectId),
          eq(deploymentReceipts.bindingId, reference.bindingId),
          eq(deploymentReceipts.deploymentId, reference.deploymentId),
        ),
      ),
  )
  if (
    !receipt ||
    receipt.manifest.artifactDigest !== reference.artifactDigest ||
    (reportedEnvironment !== null &&
      receipt.environment !== reportedEnvironment)
  ) {
    return unknown
  }
  const probe = receipt.manifest.probes.find(
    ({ probeId }) => probeId === reference.probeId,
  )
  if (!probe || probe.location.kind !== "source") {
    return unknown
  }
  return {
    status: "bound",
    manifestDigest: receipt.manifestDigest,
    revision: receipt.manifest.revision,
    environment: receipt.environment,
    behaviorId: probe.behaviorId,
    behaviorRevision: probe.behaviorRevision,
  } satisfies RuntimeObservationBinding
})
