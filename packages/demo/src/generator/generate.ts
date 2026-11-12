import { Array, Schema } from "effect"
import { clinics, DATASET, type Clinic } from "../scenarios/catalog.js"
import { canonical, digest } from "./identity.js"
import { makeRun, type RunSpec, type SyntheticRun } from "./events.js"

import { dayContext } from "./day-context.js"
import { referralIngestion } from "./referrals.js"
import { patientJourney } from "./patient-journey.js"
import { laboratorySync, integrationHealth } from "./integrations.js"
import { GeneratorConfig, type Dataset } from "./configuration.js"
export { GeneratorConfig, defaultSeed, type Dataset } from "./configuration.js"

/** The seed is keyed by logical case identity. There is no global PRNG or wall clock. */
export const generate = (input: GeneratorConfig): Dataset => {
  const config = Schema.decodeUnknownSync(GeneratorConfig)(input)
  const configHash = digest(canonical({ dataset: DATASET, ...config }))
  const build = (spec: RunSpec) => makeRun(spec, configHash)
  const dayRuns = (day: number, clinic: Clinic): readonly SyntheticRun[] => {
    const state = dayContext(config, day, clinic)
    const ingestion = referralIngestion(state, build)
    return [
      ingestion,
      ...patientJourney(state, ingestion, build),
      laboratorySync(state, build),
      ...integrationHealth(state, build),
    ]
  }
  const generated = Array.flatMap(Array.range(1, 30), (day) =>
    Array.flatMap(clinics, (clinic) => dayRuns(day, clinic)),
  )
  // Fixed last-report cases make the distinction between overdue and currently pending visible.
  const recent = build({
    workflow: "appointment.book",
    key: "recent-pending",
    at: Date.parse(config.reference) - 20 * 60000,
    duration: 1200,
    correlationId: "SYN-RECENT-PENDING",
    properties: {
      provider: "cedar-health",
      clinic: "cedar-grove",
      integration: "orbit-scheduling",
      bookingRef: "SYN-BOOK-RECENT",
    },
    result: { requested: 1, pending: 1 },
    outcome: "pending_confirmation",
    expectation: "pending",
  })
  return { identity: DATASET, config, configHash, runs: [...generated, recent] }
}

export const summarize = (dataset: Dataset) => ({
  dataset: dataset.identity,
  config: dataset.config,
  configHash: dataset.configHash,
  runs: dataset.runs.length,
  events: Array.reduce(
    dataset.runs,
    0,
    (total, run) => total + run.events.length,
  ),
  workflows: Object.fromEntries(
    Array.map(
      Object.entries(Array.groupBy(dataset.runs, (run) => run.workflow)),
      ([name, runs]) => [name, runs.length],
    ),
  ),
})
