import { Schema } from "effect"
export const PeerSelectionSchema = Schema.Struct({
  days: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 1, maximum: 90 }),
    ),
  ),
  environment: Schema.optional(Schema.Literals(["same", "all"])),
  sameRelease: Schema.optional(Schema.Boolean),
  dimensionKey: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128)),
  ),
  dimensionValue: Schema.optional(
    Schema.String.check(Schema.isMaxLength(2048)),
  ),
}).check(
  Schema.makeFilter(
    (value) =>
      (value.dimensionKey === undefined) ===
      (value.dimensionValue === undefined),
  ),
)
export type PeerSelection = typeof PeerSelectionSchema.Type
export interface PeerPopulation {
  readonly eligible: number
  readonly durationObservations: number
  readonly selected: number
  readonly minimumSample: number
  readonly days: number
  readonly environment: string | null
  readonly allEnvironments: boolean
  readonly sameRelease: boolean
  readonly release: string | null
}
