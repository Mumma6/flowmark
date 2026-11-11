import { Schema } from "effect"
import { DATASET } from "../scenarios/catalog.js"
import type { SyntheticRun } from "./events.js"

export const GeneratorConfig = Schema.Struct({
  reference: Schema.String.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/),
    Schema.makeFilter(
      (value) =>
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString() === value,
    ),
  ),
  seed: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(80)),
})
export type GeneratorConfig = typeof GeneratorConfig.Type
export const defaultSeed = "meridian-health-2026-v1"

export interface Dataset {
  readonly identity: typeof DATASET
  readonly config: GeneratorConfig
  readonly configHash: string
  readonly runs: readonly SyntheticRun[]
}
