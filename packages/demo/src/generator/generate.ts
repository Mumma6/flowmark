import { Array, Schema } from "effect"
import { clinics, DATASET, phase, type Clinic } from "../scenarios/catalog.js"
import { canonical, digest, sample } from "./identity.js"
import { makeRun, type RunSpec, type SyntheticRun } from "./events.js"

const DAY = 86400000
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

/** The seed is keyed by logical case identity. There is no global PRNG or wall clock. */
export const generate = (input: GeneratorConfig): Dataset => {
  const config = Schema.decodeUnknownSync(GeneratorConfig)(input)
  const configHash = digest(canonical({ dataset: DATASET, ...config }))
  const random = (key: string) => sample(config.seed, key)
  const build = (spec: RunSpec) => makeRun(spec, configHash)
  const base = Date.parse(config.reference) - 30 * DAY
  const dayRuns = (day: number, clinic: Clinic): readonly SyntheticRun[] => {
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
    const duplicates = Math.floor(
      received * (0.002 + draw("duplicate") * 0.008),
    )
    const ingestFailure =
      !(day === 30 && clinic.id === "harbor-bay") &&
      draw("ingest-failure") < 0.012
    const ingestKey = `${key}:referral`
    const ingestion = build({
      workflow: "referral.ingest",
      key: ingestKey,
      at,
      duration: 900 + Math.floor(draw("ingest-duration") * 4200),
      correlationId,
      properties: { ...context, integration: clinic.referrals, batchRef },
      result: ingestFailure
        ? { received }
        : {
            received,
            accepted: received - rejected - review - duplicates,
            rejected,
            review,
            duplicates,
            reasons: {
              missing_clinic: Math.floor(rejected * 0.6),
              missing_contact: rejected - Math.floor(rejected * 0.6),
              manual_review: review,
              duplicate_reference: duplicates,
            },
          },
      outcome: ingestFailure
        ? undefined
        : rejected > received * 0.1
          ? "partial"
          : "accepted",
      failure: ingestFailure ? "REFERRAL_SOURCE_UNAVAILABLE" : undefined,
    })
    // These are explicitly sampled accepted referrals, not an exhaustive expansion of the batch.
    const cases = ingestFailure
      ? []
      : Array.flatMap(
          Array.range(0, (weekend ? 2 : 4) + Math.floor(draw("cases") * 3)),
          (index) => {
            const caseKey = `${key}:case${index}`
            const caseDraw = (part: string) => random(`${caseKey}:${part}`)
            const referralRef = `SYN-REF-${key}-${index}`
            const patientRef = `SYN-PATIENT-${clinic.id}-${String((day * 7 + index) % 113).padStart(3, "0")}`
            const bookingRef = `SYN-BOOK-${key}-${index}`
            const correlation = `SYN-CASE-${key}-${index}`
            const properties = {
              ...context,
              batchRef,
              referralRef,
              patientRef,
              bookingRef,
              sampledFromBatch: true,
            }
            const matchPick =
              day === 30 && index === 0 && clinic.id === "harbor-bay"
                ? 0.9
                : caseDraw("match")
            const matchOutcome =
              matchPick < (dirty ? 0.3 : 0.035)
                ? "no_match"
                : matchPick < (dirty ? 0.47 : 0.06)
                  ? "ambiguous_match"
                  : matchPick < (dirty ? 0.52 : 0.07)
                    ? "validation_failure"
                    : "matched"
            const match = build({
              workflow: "patient.match",
              key: `${caseKey}:match`,
              at: at + 15000 + index * 1500000,
              duration: 200 + Math.floor(caseDraw("match-duration") * 1800),
              correlationId: correlation,
              parentRunId: ingestion.runId,
              properties: { ...properties, integration: clinic.referrals },
              result: {
                checked: 1,
                matched: Number(matchOutcome === "matched"),
                ambiguous: Number(matchOutcome === "ambiguous_match"),
                unmatched: Number(matchOutcome === "no_match"),
                invalid: Number(matchOutcome === "validation_failure"),
                reasons:
                  matchOutcome === "matched" ? {} : { [matchOutcome]: 1 },
              },
              outcome: matchOutcome,
            })
            if (matchOutcome !== "matched") {
              return [match]
            }
            const requestAt = at + 30000 + index * 1500000
            const pick = caseDraw("booking")
            const timeout = pick < (degraded ? 0.19 : recovering ? 0.04 : 0.012)
            const pending = !timeout && pick < (degraded ? 0.43 : 0.06)
            const unavailable =
              !timeout && !pending && pick < (degraded ? 0.5 : 0.13)
            const conflict =
              !timeout &&
              !pending &&
              !unavailable &&
              pick < (degraded ? 0.54 : 0.15)
            const incomplete =
              day === 30 && index === 0 && clinic.id === "harbor-bay"
            const outcome = pending
              ? "pending_confirmation"
              : unavailable
                ? "no_availability"
                : conflict
                  ? "booking_conflict"
                  : "confirmed"
            const retry =
              !timeout &&
              !pending &&
              caseDraw("retry") < (degraded ? 0.4 : 0.025)
            const booking = build({
              workflow: "appointment.book",
              key: `${caseKey}:book`,
              at: requestAt,
              duration: Math.floor(
                (timeout ? 30000 : degraded ? 5000 : 450) +
                  caseDraw("booking-duration") * (degraded ? 18000 : 900),
              ),
              correlationId: correlation,
              parentRunId: match.runId,
              properties: { ...properties, integration: clinic.scheduler },
              result:
                timeout || incomplete
                  ? { requested: 1 }
                  : pending
                    ? { requested: 1, pending: 1, reasons: { awaiting_ack: 1 } }
                    : {
                        requested: 1,
                        confirmed: Number(!unavailable && !conflict),
                        unavailable: Number(unavailable),
                        conflicts: Number(conflict),
                        pending: 0,
                        reasons: unavailable
                          ? { no_availability: 1 }
                          : conflict
                            ? { booking_conflict: 1 }
                            : {},
                      },
              outcome: timeout || incomplete ? undefined : outcome,
              failure: timeout && !incomplete ? "SCHEDULER_TIMEOUT" : undefined,
              incomplete,
              retry: retry && !incomplete,
              expectation: pending
                ? caseDraw("confirmation") < 0.45
                  ? "late"
                  : "overdue"
                : undefined,
            })
            if (incomplete || unavailable || conflict) {
              return [match, booking]
            }
            if (timeout) {
              // A distinct, application-owned run retry, qualified by workflow and run identity.
              if (caseDraw("run-retry") > 0.6) {
                return [match, booking]
              }
              const resumed = build({
                workflow: "appointment.book",
                key: `${caseKey}:book-retry`,
                at: requestAt + 180000,
                duration: 1600,
                correlationId: correlation,
                parentRunId: match.runId,
                retryOf: { workflow: booking.workflow, runId: booking.runId },
                properties: { ...properties, integration: clinic.scheduler },
                result: { requested: 1, confirmed: 1, pending: 0 },
                outcome: "confirmed",
              })
              return [
                match,
                booking,
                resumed,
                notification(
                  `${caseKey}:notify-retry`,
                  requestAt + 190000,
                  resumed.runId,
                  correlation,
                  properties,
                  caseDraw("notification"),
                ),
              ]
            }
            if (pending) {
              return [match, booking]
            }
            return [
              match,
              booking,
              notification(
                `${caseKey}:notify`,
                requestAt + 90000,
                booking.runId,
                correlation,
                properties,
                caseDraw("notification"),
              ),
            ]
          },
        )
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
    return [ingestion, ...cases, lab, ...health]
  }
  const notification = (
    key: string,
    at: number,
    parentRunId: string,
    correlationId: string,
    properties: RunSpec["properties"],
    pick: number,
  ) => {
    const permanent = pick < 0.018
    const temporary = pick >= 0.018 && pick < 0.035
    const pending = pick >= 0.035 && pick < 0.08
    return build({
      workflow: "notification.dispatch",
      key,
      at,
      duration: 650,
      parentRunId,
      correlationId,
      properties: {
        ...properties,
        integration: "meridian-notify",
        channel: "synthetic-push",
      },
      result: temporary
        ? { requested: 1 }
        : pending
          ? { requested: 1, pending: 1, reasons: { awaiting_ack: 1 } }
          : {
              requested: 1,
              delivered: Number(!permanent),
              rejected: Number(permanent),
              reasons: permanent ? { destination_rejected: 1 } : {},
            },
      failure: temporary ? "NOTIFICATION_PROVIDER_TIMEOUT" : undefined,
      outcome: temporary
        ? undefined
        : permanent
          ? "rejected"
          : pending
            ? "pending_ack"
            : "delivered",
      expectation: pending ? "on-time" : undefined,
    })
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
