import { Array, Match, Option, Schema } from "effect"

const Identifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
)
const Instant = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/),
)
const Handle = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/),
)
const Digest = Schema.String.check(Schema.isPattern(/^sha256:[a-f0-9]{64}$/))
const revision = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 1_000_000 }),
)

export const CoverageDiscoveryStatusSchema = Schema.Literals([
  "matched",
  "source-only",
  "deployed-only",
  "unsupported",
  "policy-excluded",
])
export const CoverageReadinessStatusSchema = Schema.Literals([
  "verified",
  "missing",
  "stale",
  "failed",
  "excluded",
])
export const CoverageAnswerabilityStatusSchema = Schema.Literals([
  "observed",
  "partial",
  "waiting-for-eligible-traffic",
  "unknown-population",
  "known-loss",
  "unsupported",
])

export const CoverageStoredEventSchema = Schema.Struct({
  eventId: Schema.String.check(Schema.isUUID()),
  handle: Schema.NullOr(Handle),
  kind: Schema.Literals(["observation", "loss"]),
  artifactDigest: Digest,
  environment: Identifier,
  behaviorRevision: Identifier,
  occurredAt: Instant,
})
export type CoverageStoredEvent = typeof CoverageStoredEventSchema.Type

export const CoverageObservationQuerySchema = Schema.Struct({
  environment: Identifier,
  artifactDigest: Digest,
  behaviorRevision: Identifier,
  startedAt: Instant,
  endedAt: Instant,
})
export type CoverageObservationQuery =
  typeof CoverageObservationQuerySchema.Type

const DeliverySchema = Schema.Struct({
  eventId: Schema.String.check(Schema.isUUID()),
  handle: Handle,
  questionId: Identifier,
  questionRevision: revision,
  release: Digest,
  environment: Identifier,
  behaviorRevision: Identifier,
  occurredAt: Instant,
  admissible: Schema.Boolean,
  mature: Schema.Boolean,
  outcome: Schema.NullOr(Schema.String.check(Schema.isMaxLength(120))),
  confirmation: Schema.NullOr(Schema.String.check(Schema.isMaxLength(120))),
  kind: Schema.Literals(["resolution", "loss", "confirmation"]),
})

export const CoverageAssessmentInputSchema = Schema.Struct({
  questionId: Identifier,
  questionRevision: revision,
  release: Digest,
  behaviorRevision: Identifier,
  environment: Identifier,
  provenance: Schema.Literals(["local", "fixture", "staging", "production"]),
  populationSource: Schema.NullOr(
    Schema.Struct({
      id: Identifier,
      kind: Schema.Literal("outbox"),
    }),
  ),
  window: Schema.Struct({ start: Instant, end: Instant }),
  maturityDelayMs: Schema.Int.check(
    Schema.isBetween({ minimum: 0, maximum: 7 * 24 * 60 * 60 * 1000 }),
  ),
  observedAt: Instant,
  supportExpiresAt: Schema.NullOr(Instant),
  sampling: Schema.Literals(["complete", "changed", "biased"]),
  join: Schema.Literals(["case-handle", "unsupported"]),
  drilldownLimit: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 24 }),
  ),
  permittedHandles: Schema.Array(Handle).check(Schema.isMaxLength(24)),
  discovery: CoverageDiscoveryStatusSchema,
  readiness: CoverageReadinessStatusSchema,
  population: Schema.Array(
    Schema.Struct({ handle: Handle, eligibleAt: Instant }),
  ).check(Schema.isMaxLength(200)),
  deliveries: Schema.Array(DeliverySchema).check(Schema.isMaxLength(400)),
  stored: Schema.optional(
    Schema.Array(CoverageStoredEventSchema).check(Schema.isMaxLength(400)),
  ),
  storedTruncated: Schema.optional(Schema.Boolean),
})
export type CoverageAssessmentInput = typeof CoverageAssessmentInputSchema.Type

const inWindow = (instant: string, start: string, end: string) =>
  instant >= start && instant < end

const millis = (instant: string) => Date.parse(instant)

const dedupe = <T extends { readonly eventId: string }>(items: readonly T[]) =>
  Array.reduce(items, [] as T[], (seen, item) =>
    Array.some(seen, (current) => current.eventId === item.eventId)
      ? seen
      : [...seen, item],
  )

type Delivery = typeof DeliverySchema.Type

const storedDelivery = (
  input: CoverageAssessmentInput,
  event: CoverageStoredEvent,
): Option.Option<Delivery> =>
  event.artifactDigest === input.release &&
  event.environment === input.environment &&
  event.behaviorRevision === input.behaviorRevision &&
  event.handle !== null
    ? Option.some({
        eventId: event.eventId,
        handle: event.handle,
        questionId: input.questionId,
        questionRevision: input.questionRevision,
        release: input.release,
        environment: input.environment,
        behaviorRevision: input.behaviorRevision,
        occurredAt: event.occurredAt,
        admissible: event.kind === "observation",
        mature: true,
        outcome: null,
        confirmation: null,
        kind: event.kind === "loss" ? "loss" : "resolution",
      })
    : Option.none()

const matching = (input: CoverageAssessmentInput, delivery: Delivery) =>
  delivery.questionId === input.questionId &&
  delivery.questionRevision === input.questionRevision &&
  delivery.release === input.release &&
  delivery.environment === input.environment &&
  delivery.behaviorRevision === input.behaviorRevision &&
  inWindow(delivery.occurredAt, input.window.start, input.window.end)

export const assessLiveCoverage = (input: CoverageAssessmentInput) => {
  const stored = Array.getSomes(
    Array.map(input.stored ?? [], (event) => storedDelivery(input, event)),
  )
  const deliveries = Array.filter(
    dedupe([...input.deliveries, ...stored]),
    (delivery) => matching(input, delivery),
  )
  const unscopedLoss = Array.filter(
    input.stored ?? [],
    (event) =>
      event.kind === "loss" &&
      event.handle === null &&
      event.artifactDigest === input.release &&
      event.environment === input.environment &&
      inWindow(event.occurredAt, input.window.start, input.window.end),
  ).length
  const eligible = Array.filter(input.population, (item) =>
    inWindow(item.eligibleAt, input.window.start, input.window.end),
  )
  const cases = Array.map(eligible, (item) => {
    const rows = Array.filter(
      deliveries,
      (delivery) => delivery.handle === item.handle,
    )
    const timeMature =
      millis(input.observedAt) >=
      millis(item.eligibleAt) + input.maturityDelayMs
    const resolution = Array.findFirst(
      rows,
      (delivery) =>
        delivery.kind === "resolution" &&
        delivery.admissible &&
        delivery.mature &&
        timeMature,
    )
    const loss = Array.findFirst(rows, (delivery) => delivery.kind === "loss")
    const confirmation = Array.findFirst(
      rows,
      (delivery) =>
        delivery.kind === "confirmation" && delivery.confirmation !== null,
    )
    const reason = Option.match(resolution, {
      onSome: () => "resolved" as const,
      onNone: () =>
        Match.value(timeMature).pipe(
          Match.when(false, () => "immature" as const),
          Match.orElse(() =>
            Option.match(loss, {
              onSome: () => "delivery-loss" as const,
              onNone: () => "unresolved" as const,
            }),
          ),
        ),
    })
    return {
      handle: item.handle,
      reason,
      outcome: Option.match(resolution, {
        onSome: (delivery) => delivery.outcome,
        onNone: () => null,
      }),
      confirmation: Option.match(confirmation, {
        onSome: (delivery) => delivery.confirmation,
        onNone: () => null,
      }),
    }
  })
  const resolved = Array.filter(cases, (item) => item.reason === "resolved")
  const unresolved = Array.filter(cases, (item) => item.reason !== "resolved")
  const immature = Array.filter(cases, (item) => item.reason === "immature")
  const losses =
    Array.filter(cases, (item) => item.reason === "delivery-loss").length +
    unscopedLoss
  const retained = Array.dedupe(
    Array.getSomes(
      Array.map(deliveries, (delivery) =>
        delivery.kind === "resolution" && delivery.admissible
          ? Option.some(delivery.handle)
          : Option.none(),
      ),
    ),
  )
  const gate = Array.get(
    Array.getSomes([
      input.join === "unsupported"
        ? Option.some({
            status: "unsupported" as const,
            limitation: "unsupported-join" as const,
          })
        : Option.none(),
      input.supportExpiresAt !== null &&
      input.supportExpiresAt <= input.observedAt
        ? Option.some({
            status: "unsupported" as const,
            limitation: "expired-support" as const,
          })
        : Option.none(),
      input.sampling === "changed"
        ? Option.some({
            status: "unknown-population" as const,
            limitation: "changed-sampling" as const,
          })
        : Option.none(),
      input.sampling === "biased"
        ? Option.some({
            status: "unknown-population" as const,
            limitation: "biased-sampling" as const,
          })
        : Option.none(),
      input.populationSource === null
        ? Option.some({
            status: "unknown-population" as const,
            limitation: "missing-counter" as const,
          })
        : Option.none(),
      input.storedTruncated === true
        ? Option.some({
            status: "unknown-population" as const,
            limitation: "truncated" as const,
          })
        : Option.none(),
      eligible.length === 0
        ? Option.some({
            status: "waiting-for-eligible-traffic" as const,
            limitation: "none" as const,
          })
        : Option.none(),
      losses > 0
        ? Option.some({
            status: "known-loss" as const,
            limitation: "delivery-loss" as const,
          })
        : Option.none(),
      immature.length > 0
        ? Option.some({
            status: "partial" as const,
            limitation: "immature" as const,
          })
        : Option.none(),
      resolved.length === eligible.length
        ? Option.some({
            status: "observed" as const,
            limitation: "none" as const,
          })
        : Option.none(),
    ]),
    0,
  )
  const decided = gate.pipe(
    Option.getOrElse(() => ({
      status: "partial" as const,
      limitation: "none" as const,
    })),
  )
  const rate =
    decided.status === "observed" ||
    decided.status === "partial" ||
    decided.status === "known-loss"
      ? { resolved: resolved.length, eligible: eligible.length }
      : null
  const visible = Array.filter(unresolved, (item) =>
    Array.contains(input.permittedHandles, item.handle),
  )
  const repair = Match.value(decided.status).pipe(
    Match.when("partial", () =>
      decided.limitation === "immature"
        ? ("none" as const)
        : ("missing-observation" as const),
    ),
    Match.when("known-loss", () => "none" as const),
    Match.orElse(() => "none" as const),
  )
  return {
    discovery: {
      status: input.discovery,
      provenance: "independent-of-answerability" as const,
    },
    readiness: {
      status: input.readiness,
      questionRevision: input.questionRevision,
      release: input.release,
      provenance: "fixture-readback" as const,
    },
    answerability: {
      status: decided.status,
      questionRevision: input.questionRevision,
      release: input.release,
      environment: input.environment,
      provenance: input.provenance,
      populationSource: input.populationSource,
      window: input.window,
      maturityDelayMs: input.maturityDelayMs,
      limitation: decided.limitation,
      eligible: eligible.length,
      resolved: resolved.length,
      unresolved: unresolved.length,
      retained: retained.length,
      rate,
      redacted: unresolved.length - visible.length,
      drilldown: Array.take(visible, input.drilldownLimit),
      outcomes: Array.map(resolved, (item) => ({
        handle: item.handle,
        outcome: item.outcome,
        confirmation: item.confirmation,
      })),
      repair,
    },
  }
}
