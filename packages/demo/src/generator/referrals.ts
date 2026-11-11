import type { DayContext } from "./day-context.js"
import type { makeRun } from "./events.js"
export const referralIngestion = (
  day: DayContext,
  build: (spec: Parameters<typeof makeRun>[0]) => ReturnType<typeof makeRun>,
) => {
  const {
    ingestKey,
    at,
    draw,
    correlationId,
    context,
    clinic,
    batchRef,
    ingestFailure,
    received,
    rejected,
    review,
    duplicates,
  } = day
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

  return ingestion
}
