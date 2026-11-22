import { Schema } from "effect"

export const RUNTIME_OBSERVATION_CAPABILITY = "runtime-observations-v1"

export const RuntimeReferenceKindSchema = Schema.Literals([
  "entity",
  "change",
  "envelope",
])
export const RuntimeReferenceNamespaceSchema = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9._-]{0,63}$/),
)
export const RuntimeReferenceSchema = Schema.Struct({
  kind: RuntimeReferenceKindSchema,
  namespace: RuntimeReferenceNamespaceSchema,
  digest: Schema.String.check(Schema.isPattern(/^hmac-sha256:[a-f0-9]{64}$/)),
})

export const RuntimeProbeReferenceSchema = Schema.Struct({
  bindingId: Schema.String.check(Schema.isUUID()),
  deploymentId: Schema.String.check(
    Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,159}$/),
  ),
  artifactDigest: Schema.String.check(
    Schema.isPattern(/^sha256:[a-f0-9]{64}$/),
  ),
  probeId: Schema.String.check(
    Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
  ),
})

export const RuntimeObservationSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("observation"),
    probe: Schema.optional(RuntimeProbeReferenceSchema),
    references: Schema.Array(RuntimeReferenceSchema).check(
      Schema.isMaxLength(12),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("loss"),
    probe: Schema.optional(RuntimeProbeReferenceSchema),
    count: Schema.Int.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(1_000_000),
    ),
  }),
])

export type RuntimeObservation = typeof RuntimeObservationSchema.Type
export type RuntimeProbeReference = typeof RuntimeProbeReferenceSchema.Type
export type RuntimeReferenceKind = typeof RuntimeReferenceKindSchema.Type

export type RuntimeObservationBinding =
  | { readonly status: "unknown" }
  | {
      readonly status: "bound"
      readonly manifestDigest: string
      readonly revision: string
      readonly environment: string
      readonly behaviorId: string
      readonly behaviorRevision: string
    }

export type StoredRuntimeObservation = {
  readonly observation: RuntimeObservation
  readonly binding: RuntimeObservationBinding
}

export const ExecutionSelectorSchema = Schema.Struct({
  reference: Schema.optional(RuntimeReferenceSchema),
  artifactDigest: Schema.optional(
    RuntimeProbeReferenceSchema.fields.artifactDigest,
  ),
  behaviorId: Schema.optional(RuntimeProbeReferenceSchema.fields.probeId),
})
export type ExecutionSelector = typeof ExecutionSelectorSchema.Type
