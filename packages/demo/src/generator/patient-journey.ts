import { Array } from "effect"
import type { DayContext } from "./day-context.js"
import type { makeRun } from "./events.js"
type Build = (spec: Parameters<typeof makeRun>[0]) => ReturnType<typeof makeRun>
import { notificationBuilder } from "./notification.js"
export const patientJourney = (
  state: DayContext,
  ingestion: ReturnType<Build>,
  build: Build,
) => {
  const {
    day,
    clinic,
    key,
    random,
    context,
    batchRef,
    at,
    ingestFailure,
    weekend,
    draw,
    dirty,
    degraded,
    recovering,
  } = state
  const notification = notificationBuilder(build)
  // These are explicitly sampled accepted referrals, not an exhaustive expansion of the batch.
  return ingestFailure
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
              reasons: matchOutcome === "matched" ? {} : { [matchOutcome]: 1 },
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
            !timeout && !pending && caseDraw("retry") < (degraded ? 0.4 : 0.025)
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
}
