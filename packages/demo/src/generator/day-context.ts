import { phase, type Clinic } from "../scenarios/catalog.js"
import { sample } from "./identity.js"
import type { GeneratorConfig } from "./configuration.js"
export const DAY = 86400000
export const dayContext = (
  config: GeneratorConfig,
  day: number,
  clinic: Clinic,
) => {
  const base = Date.parse(config.reference) - 30 * DAY
  const random = (key: string) => sample(config.seed, key)
  const key = `d${String(day).padStart(2, "0")}:${clinic.id}`
  const draw = (part: string) => random(`${key}:${part}`)
  const weekday = new Date(base + (day - 1) * DAY).getUTCDay()
  const weekend = weekday === 0 || weekday === 6
  const at = base + (day - 1) * DAY + (7 + draw("arrival") * 2) * 3600000
  const degraded =
    day >= 11 && day <= 17 && clinic.scheduler === "orbit-scheduling"
  const dirty = day >= 18 && day <= 23 && clinic.provider === "cedar-health"
  const recovering =
    day >= 24 && day <= 26 && clinic.scheduler === "orbit-scheduling"
  const context = {
    provider: clinic.provider,
    clinic: clinic.id,
    careUnit: `${clinic.id}-outpatient`,
    incidentPhase: phase(day),
  }
  const batchRef = `SYN-BATCH-${key}`
  const correlationId = `SYN-JOURNEY-${key}`
  const received = Math.floor(
    (weekend ? 150 : 850) + draw("volume") * (weekend ? 200 : 500),
  )
  const rejected = Math.floor(
    received *
      ((dirty ? 0.17 : 0.008) + draw("reject") * (dirty ? 0.1 : 0.015)),
  )
  const review = Math.floor(received * (0.009 + draw("review") * 0.015))
  const duplicates = Math.floor(received * (0.002 + draw("duplicate") * 0.008))
  const ingestFailure =
    !(day === 30 && clinic.id === "harbor-bay") &&
    draw("ingest-failure") < 0.012
  const ingestKey = `${key}:referral`

  return {
    key,
    draw,
    weekday,
    weekend,
    at,
    degraded,
    dirty,
    recovering,
    context,
    batchRef,
    correlationId,
    received,
    rejected,
    review,
    duplicates,
    ingestFailure,
    ingestKey,
    base,
    random,
    day,
    clinic,
  }
}
export type DayContext = ReturnType<typeof dayContext>
