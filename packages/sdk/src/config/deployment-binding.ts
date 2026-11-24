import { RuntimeProbeReferenceSchema } from "@flowmarkdev/core"
import type { RuntimeProbeReference } from "@flowmarkdev/core"
import { Option, Schema } from "effect"

/**
 * Optional server binding for the deployment that is executing this process.
 * Incomplete values are not a configured binding: the client then emits no
 * deployment observation and leaves the workflow result unchanged.
 */
export interface DeploymentBindingConfig {
  readonly enabled?: boolean
  readonly bindingId?: string
  readonly deploymentId?: string
  readonly artifactDigest?: string
  readonly probeId?: string
}

/** A complete, schema-valid probe, or none when the binding is absent or partial. */
export function resolveDeploymentProbe(
  config: DeploymentBindingConfig | undefined,
): RuntimeProbeReference | undefined {
  if (config === undefined || config.enabled === false) {
    return undefined
  }
  return Option.match(
    Schema.decodeUnknownOption(RuntimeProbeReferenceSchema)({
      bindingId: config.bindingId,
      deploymentId: config.deploymentId,
      artifactDigest: config.artifactDigest,
      probeId: config.probeId,
    }),
    {
      onNone: () => undefined,
      onSome: (probe) => probe,
    },
  )
}
