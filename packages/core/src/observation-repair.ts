import { Match, Schema } from "effect"
import { RuntimeQuestionSchema } from "./runtime-question.js"

const Identifier = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
)
const Namespace = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/),
)

export const RepairGapSchema = Schema.Literals([
  "already-answered",
  "mapping-stale",
  "missing-change-link",
  "missing-observation",
  "restricted-field",
  "no-safe-source",
])
export type RepairGap = typeof RepairGapSchema.Type

export const RepairAccessSchema = Schema.Literals([
  "authorized",
  "denied",
  "wider-grant-required",
])

export const ObservationRepairInputSchema = Schema.Struct({
  questionId: Identifier,
  questionRevision: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 1_000_000 }),
  ),
  repository: Identifier,
  gap: RepairGapSchema,
  access: RepairAccessSchema,
  traffic: Schema.Literals(["fixture-ready", "immature"]),
  approvedNamespaces: Schema.Array(Namespace).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(12),
  ),
  requestedNamespace: Schema.optional(Namespace),
  reportingSite: Schema.optional(Identifier),
  maxOverheadMs: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 100 }),
  ),
  attempt: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
})
export type ObservationRepairInput = typeof ObservationRepairInputSchema.Type

const Branch = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,120}$/),
)
const WindowInstant = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(40),
)

/** Caller context for a repair. The stored evidence supplies the gap. */
export const StoredObservationRepairSchema = Schema.Struct({
  question: Schema.suspend(() => RuntimeQuestionSchema),
  repository: Identifier,
  branch: Branch,
  access: RepairAccessSchema,
  traffic: Schema.Literals(["fixture-ready", "immature"]),
  approvedNamespaces: Schema.Array(Namespace).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(12),
  ),
  reportingSites: Schema.Array(Identifier).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(12),
  ),
  maxOverheadMs: Schema.Int.check(
    Schema.isBetween({ minimum: 1, maximum: 100 }),
  ),
  attempt: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 100 })),
  startedAfter: WindowInstant,
  startedBefore: WindowInstant,
  environment: Schema.optional(Identifier),
})
export type StoredObservationRepair = typeof StoredObservationRepairSchema.Type

export const RepairRemedySchema = Schema.Literals([
  "reuse-event",
  "repair-mapping",
  "add-permitted-reference",
  "add-typed-observation",
  "none",
])

export const ObservationRepairPlanSchema = Schema.Struct({
  status: Schema.Literals([
    "proposed",
    "refused",
    "unsupported",
    "owner-approval",
  ]),
  remedy: RepairRemedySchema,
  branch: Schema.String,
  attempt: Schema.Int,
  merged: Schema.Literal(false),
  questionRevision: Schema.Int,
  files: Schema.Array(
    Schema.Struct({
      path: Schema.String.check(Schema.isMaxLength(180)),
      purpose: Schema.String.check(Schema.isMaxLength(240)),
    }),
  ).check(Schema.isMaxLength(4)),
  fields: Schema.Array(Namespace).check(Schema.isMaxLength(12)),
  overheadMs: Schema.Int,
  test: Schema.NullOr(Schema.String),
  production: Schema.Literal("pending"),
  explanation: Schema.String.check(Schema.isMaxLength(500)),
})
export type ObservationRepairPlan = typeof ObservationRepairPlanSchema.Type

const branchFor = (questionId: string) =>
  `flowmark/repair-${questionId.replaceAll("/", "-")}`

const refused = (
  input: ObservationRepairInput,
  explanation: string,
): ObservationRepairPlan => ({
  status: "refused",
  remedy: "none",
  branch: branchFor(input.questionId),
  attempt: input.attempt,
  merged: false,
  questionRevision: input.questionRevision,
  files: [],
  fields: [],
  overheadMs: 0,
  test: null,
  production: "pending",
  explanation,
})

const plan = (
  input: ObservationRepairInput,
  patch: Omit<
    ObservationRepairPlan,
    "branch" | "attempt" | "merged" | "production"
  >,
): ObservationRepairPlan => ({
  ...patch,
  branch: branchFor(input.questionId),
  attempt: input.attempt,
  merged: false,
  production: "pending",
})

/**
 * Choose the smallest in-policy repair for one diagnosed gap.
 * Denied reads and immature traffic never add capture. The proposal updates
 * in place and cannot merge itself. Production evidence stays pending.
 */
export function planObservationRepair(
  input: ObservationRepairInput,
): ObservationRepairPlan {
  if (input.access === "denied") {
    return refused(
      input,
      "The read grant is denied. No additional capture is proposed.",
    )
  }
  if (input.traffic === "immature" && input.gap !== "already-answered") {
    return refused(
      input,
      "Traffic is immature. Waiting is not a reason to add capture.",
    )
  }
  if (input.access === "wider-grant-required") {
    return plan(input, {
      status: "owner-approval",
      remedy: "none",
      questionRevision: input.questionRevision,
      files: [],
      fields: [],
      overheadMs: 0,
      test: null,
      explanation:
        "The repair would widen the read or collection grant. An owner must approve that separately.",
    })
  }
  const namespace = input.requestedNamespace
  const namespaceAllowed =
    namespace !== undefined && input.approvedNamespaces.includes(namespace)
  return Match.value(input.gap).pipe(
    Match.when("already-answered", () =>
      plan(input, {
        status: "proposed",
        remedy: "reuse-event",
        questionRevision: input.questionRevision,
        files: [],
        fields: [],
        overheadMs: 0,
        test: null,
        explanation:
          "A trusted event already carries the fact. Reuse it. No source edit.",
      }),
    ),
    Match.when("mapping-stale", () =>
      plan(input, {
        status: "proposed",
        remedy: "repair-mapping",
        questionRevision: input.questionRevision,
        files: [
          {
            path: "artifact-manifest.json",
            purpose:
              "Point the existing probe at the current source path and symbol.",
          },
        ],
        fields: [],
        overheadMs: 0,
        test: `test/flowmark-${input.questionId}.test.ts`,
        explanation:
          "Repair the source mapping only. The reporting site and fields stay the same.",
      }),
    ),
    Match.when("missing-change-link", () => {
      if (!namespaceAllowed || !namespace || !input.reportingSite) {
        return plan(input, {
          status: "unsupported",
          remedy: "none",
          questionRevision: input.questionRevision,
          files: [],
          fields: [],
          overheadMs: 0,
          test: null,
          explanation:
            "No existing reporting site has an approved namespace for the missing link.",
        })
      }
      return plan(input, {
        status: "proposed",
        remedy: "add-permitted-reference",
        questionRevision: input.questionRevision + 1,
        files: [
          {
            path: input.reportingSite,
            purpose: `Add the permitted ${namespace} reference at the existing confirmation site.`,
          },
          {
            path: `test/flowmark-${input.questionId}.test.ts`,
            purpose:
              "Distinguish the linked confirmation from a look-alike and a rollback.",
          },
        ],
        fields: [namespace],
        overheadMs: 1,
        test: `test/flowmark-${input.questionId}.test.ts`,
        explanation:
          "Add one already permitted logical reference where the confirmation is reported. A future session can ask whether the receipt names the same change. Production observation remains pending.",
      })
    }),
    Match.when("missing-observation", () => {
      if (!namespaceAllowed || !namespace || input.maxOverheadMs < 5) {
        return plan(input, {
          status: "unsupported",
          remedy: "none",
          questionRevision: input.questionRevision,
          files: [],
          fields: [],
          overheadMs: 0,
          test: null,
          explanation:
            "No safe source can carry a new observation inside the approved fields and overhead.",
        })
      }
      return plan(input, {
        status: "proposed",
        remedy: "add-typed-observation",
        questionRevision: input.questionRevision + 1,
        files: [
          {
            path: input.reportingSite ?? "src/flowmark/runtime-memory.ts",
            purpose:
              "Record one typed observation where the fact first becomes knowable.",
          },
          {
            path: `test/flowmark-${input.questionId}.test.ts`,
            purpose:
              "Read a positive case and a look-alike after the patch. A rollback must not pass.",
          },
        ],
        fields: [namespace],
        overheadMs: 5,
        test: `test/flowmark-${input.questionId}.test.ts`,
        explanation:
          "Add one typed observation at the first site that knows the fact. A future session can ask the revised question. Production observation remains pending.",
      })
    }),
    Match.when("restricted-field", () =>
      plan(input, {
        status: "unsupported",
        remedy: "none",
        questionRevision: input.questionRevision,
        files: [],
        fields: [],
        overheadMs: 0,
        test: null,
        explanation:
          "The missing fact is outside the approved field policy. No extra capture is proposed.",
      }),
    ),
    Match.when("no-safe-source", () =>
      plan(input, {
        status: "unsupported",
        remedy: "none",
        questionRevision: input.questionRevision,
        files: [],
        fields: [],
        overheadMs: 0,
        test: null,
        explanation:
          "No safe source attests the fact. The question stays unsupported.",
      }),
    ),
    Match.exhaustive,
  )
}
