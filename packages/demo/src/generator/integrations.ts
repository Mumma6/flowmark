import { Array } from "effect"
import type { DayContext } from "./day-context.js"
import type { makeRun } from "./events.js"
type Build = (spec: Parameters<typeof makeRun>[0]) => ReturnType<typeof makeRun>
import { DAY } from "./day-context.js"
export const laboratorySync = (state: DayContext, build: Build) => {
  const { day, clinic, key, at, draw, context } = state
  const labFailure =
    day >= 14 && day <= 15 && clinic.laboratory === "beacon-labs"
  const labReceived = 180 + Math.floor(draw("lab-volume") * 250)
  const labRejected = Math.floor(
    labReceived * (0.005 + draw("lab-reject") * 0.02),
  )
  const delayed = Math.floor(
    labReceived * (labFailure ? 0.4 : 0.01 + draw("lab-delay") * 0.04),
  )
  const lab = build({
    workflow: "lab-results.sync",
    key: `${key}:labs`,
    at: at + 7 * 3600000,
    duration: 2000 + Math.floor(draw("lab-duration") * 9000),
    correlationId: `SYN-LABS-${key}`,
    properties: {
      ...context,
      integration: clinic.laboratory,
      batchRef: `SYN-LABS-${key}`,
    },
    result: labFailure
      ? { received: labReceived, synchronized: Math.floor(labReceived / 3) }
      : {
          received: labReceived,
          synchronized: labReceived - labRejected - delayed,
          rejected: labRejected,
          delayed,
          reasons: { invalid_result: labRejected, awaiting_result: delayed },
        },
    failure: labFailure ? "LAB_INTEGRATION_UNAVAILABLE" : undefined,
    outcome: labFailure ? undefined : "partial",
  })

  return lab
}
export const integrationHealth = (state: DayContext, build: Build) => {
  const { day, clinic, key, draw, context, degraded, base } = state
  const health = Array.map([0, 1, 2], (slot) => {
    const outage = degraded && day >= 14 && day <= 16 && slot === 1
    return build({
      workflow: "integration.health-check",
      key: `${key}:health${slot}`,
      at: base + (day - 1) * DAY + (3 + slot * 7) * 3600000,
      duration: Math.floor(
        (outage ? 30000 : degraded ? 2000 : 120) +
          draw(`health-${slot}`) * (degraded ? 4000 : 200),
      ),
      correlationId: `SYN-HEALTH-${key}-${slot}`,
      properties: { ...context, integration: clinic.scheduler },
      result: {
        checked: 1,
        reachable: Number(!outage),
        unavailable: Number(outage),
      },
      failure: outage ? "SCHEDULER_UNAVAILABLE" : undefined,
      outcome: outage ? undefined : degraded ? "degraded" : "healthy",
    })
  })

  return health
}
