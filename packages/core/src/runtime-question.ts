import { Array, HashSet, Record, Schema } from "effect"
import { ArtifactManifestSchema } from "./artifact-manifest.js"
import {
  RuntimeProbeReferenceSchema,
  RuntimeReferenceNamespaceSchema,
} from "./runtime-observation.js"

const identifier = RuntimeProbeReferenceSchema.fields.probeId
const revision = Schema.Int.check(
  Schema.isBetween({ minimum: 1, maximum: 1_000_000 }),
)
const decision = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(200),
)
const exclusion = Schema.Literals([
  "retired",
  "unsupported-boundary",
  "policy-excluded",
])

/** Repository-owned semantics. Source paths belong to the release manifest. */
export const RuntimeQuestionSchema = Schema.Struct({
  version: Schema.Literal(1),
  id: identifier,
  revision,
  text: decision.check(Schema.makeFilter((value) => value.trim().length > 0)),
  scope: Schema.Struct({
    repository: ArtifactManifestSchema.fields.repository,
    service: identifier,
    workflow: identifier,
  }),
  behaviorId: identifier,
  behaviorRevision: identifier,
  choices: Schema.Tuple([decision, decision]),
  eligibleUnit: Schema.Literal("logical-request"),
  predicate: Schema.Literal("receipt-for-same-change"),
  requestProbe: identifier,
  committedReceiptProbe: identifier,
  changeNamespace: RuntimeReferenceNamespaceSchema,
  maturity: Schema.Literal("completed-fixture-transaction"),
  fixture: identifier,
  excludedReason: Schema.optional(exclusion),
}).check(
  Schema.makeFilter(({ requestProbe, committedReceiptProbe, choices }) => {
    return (
      requestProbe !== committedReceiptProbe &&
      choices[0].trim() !== choices[1].trim() &&
      Array.every(choices, (choice) => choice.trim().length > 0)
    )
  }),
)

export type RuntimeQuestion = typeof RuntimeQuestionSchema.Type

const sameQuestion = Schema.toEquivalence(RuntimeQuestionSchema)
export function isRuntimeQuestionSuccessor(
  previous: RuntimeQuestion,
  current: RuntimeQuestion,
) {
  return (
    current.id === previous.id &&
    (current.revision > previous.revision || sameQuestion(previous, current))
  )
}

const uuid = Schema.String.check(Schema.isUUID())
export const runtimeQuestionCases = [
  "linked",
  "otherRequest",
  "rollback",
] as const

/** CI supplies the reviewed field policy and identities independently of the declaration. */
export const RuntimeQuestionCheckSchema = Schema.Struct({
  question: RuntimeQuestionSchema,
  previousQuestion: Schema.optional(RuntimeQuestionSchema),
  fixture: identifier,
  questionId: identifier,
  questionRevision: revision,
  allowedChangeNamespaces: Schema.Array(RuntimeReferenceNamespaceSchema).check(
    Schema.isMaxLength(12),
  ),
  approvedExclusion: Schema.optional(exclusion),
  environment: identifier,
  bindingId: RuntimeProbeReferenceSchema.fields.bindingId,
  deploymentId: RuntimeProbeReferenceSchema.fields.deploymentId,
  artifactDigest: ArtifactManifestSchema.fields.artifactDigest,
  sourceRevision: ArtifactManifestSchema.fields.revision,
  runs: Schema.optional(
    Schema.Struct({ linked: uuid, otherRequest: uuid, rollback: uuid }).check(
      Schema.makeFilter(
        (runs) => HashSet.size(HashSet.fromIterable(Record.values(runs))) === 3,
      ),
    ),
  ),
})

export type RuntimeQuestionCheck = typeof RuntimeQuestionCheckSchema.Type
