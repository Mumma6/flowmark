import type {
  RuntimeQuestion,
  StoredRuntimeObservation,
} from "@flowmarkdev/core"
import { RuntimeQuestionCheckSchema } from "@flowmarkdev/core"
import { Schema } from "effect"
import { expect, it } from "vitest"
import declarationImport from "../../../../examples/questions/committed-receipt.json"
import confirmationImport from "../../../../examples/questions/later-confirmation.json"

const declaration = declarationImport as unknown as Extract<
  RuntimeQuestion,
  { predicate: "receipt-for-same-change" }
>
const confirmation = confirmationImport as unknown as Extract<
  RuntimeQuestion,
  { predicate: "confirmation-for-same-change" }
>
import {
  classifyQuestionDistinction,
  verifyQuestionCase,
} from "../../src/features/workflows/rules/assess-question-fixture.js"

const check = Schema.decodeUnknownSync(RuntimeQuestionCheckSchema)({
  question: declaration,
  environment: "fixture",
  questionId: declaration.id,
  questionRevision: 1,
  fixture: declaration.fixture,
  allowedChangeNamespaces: ["payment.request"],
  bindingId: "00000000-0000-4000-8000-000000000001",
  deploymentId: "receipt-fixture",
  artifactDigest: "sha256:" + "c".repeat(64),
  sourceRevision: "a".repeat(40),
})
const mapping = {
  manifestDigest: "sha256:" + "b".repeat(64),
  environment: "fixture",
}
const binding = {
  ...mapping,
  status: "bound" as const,
  behaviorId: declaration.behaviorId,
  behaviorRevision: "1",
  revision: check.sourceRevision,
}
const reference = {
  kind: "change" as const,
  namespace: "payment.request",
  digest: "hmac-sha256:" + "a".repeat(64),
}
function site(
  probeId: string,
  references: Extract<
    StoredRuntimeObservation["observation"],
    { kind: "observation" }
  >["references"] = [reference],
): StoredRuntimeObservation {
  return {
    binding,
    observation: {
      kind: "observation",
      probe: {
        bindingId: check.bindingId,
        deploymentId: check.deploymentId,
        artifactDigest: check.artifactDigest,
        probeId,
      },
      references,
    },
  }
}
const request = site(declaration.requestProbe)
const receipt = site(declaration.committedReceiptProbe)
const verify = (...events: StoredRuntimeObservation[]) =>
  verifyQuestionCase(check, mapping, "linked", events)

it("requires unique admissible evidence at both reporting sites", () => {
  expect(verify(request, receipt)).toMatchObject({ status: "verified" })
  expect(verify(request)).toMatchObject({ status: "missing" })
  expect(verify(request, receipt, receipt)).toMatchObject({
    reason: "ambiguous-observation",
  })
  expect(
    verify(
      request,
      site(declaration.committedReceiptProbe, [reference, reference]),
    ),
  ).toMatchObject({ reason: "ambiguous-change-link" })
  expect(
    verify(
      request,
      site(declaration.committedReceiptProbe, [
        { ...reference, namespace: "unapproved" },
      ]),
    ),
  ).toMatchObject({ reason: "field-outside-fixture-policy" })
})
it("classifies live distinctions without a fixture case target", () => {
  const context = {
    allowedChangeNamespaces: check.allowedChangeNamespaces,
    environment: mapping.environment,
    bindingId: check.bindingId,
    deploymentId: check.deploymentId,
    artifactDigest: check.artifactDigest,
    sourceRevision: check.sourceRevision,
  }
  expect(
    classifyQuestionDistinction(
      [request, receipt],
      declaration,
      context,
      mapping,
    ),
  ).toMatchObject({
    status: "observed",
    distinction: "same-change",
  })
  expect(
    classifyQuestionDistinction(
      [
        request,
        site(declaration.committedReceiptProbe, [
          { ...reference, digest: "hmac-sha256:" + "b".repeat(64) },
        ]),
      ],
      declaration,
      context,
      mapping,
    ),
  ).toMatchObject({
    status: "observed",
    distinction: "different-change",
  })
  expect(
    classifyQuestionDistinction([request], declaration, context, mapping),
  ).toMatchObject({ status: "inconclusive", reason: "missing-observation" })
})

it("keeps loss, stale provenance and contradictory evidence out of verified readiness", () => {
  expect(
    verify(request, receipt, {
      binding,
      observation: { kind: "loss", count: 1 },
    }),
  ).toMatchObject({ reason: "reported-loss" })
  expect(
    verify(request, { ...receipt, binding: { status: "unknown" } }),
  ).toMatchObject({ status: "stale" })
  expect(
    verify(request, {
      ...receipt,
      binding: { ...binding, revision: "b".repeat(40) },
    }),
  ).toMatchObject({ reason: "observation-mapping-changed" })
  expect(
    verifyQuestionCase(check, mapping, "otherRequest", [request, receipt]),
  ).toMatchObject({ status: "failed", reason: "wrong-request-distinction" })
})

it("classifies a later confirmation as supporting, contrary, or an unlinked gap", () => {
  const confirmationCheck = Schema.decodeUnknownSync(
    RuntimeQuestionCheckSchema,
  )({
    question: confirmation,
    environment: "fixture",
    questionId: confirmation.id,
    questionRevision: 1,
    fixture: confirmation.fixture,
    allowedChangeNamespaces: ["payment.request"],
    bindingId: check.bindingId,
    deploymentId: check.deploymentId,
    artifactDigest: check.artifactDigest,
    sourceRevision: check.sourceRevision,
  })
  const context = {
    allowedChangeNamespaces: confirmationCheck.allowedChangeNamespaces,
    environment: mapping.environment,
    bindingId: confirmationCheck.bindingId,
    deploymentId: confirmationCheck.deploymentId,
    artifactDigest: confirmationCheck.artifactDigest,
    sourceRevision: confirmationCheck.sourceRevision,
  }
  const attempt = site(confirmation.attemptProbe)
  const linked = site(confirmation.confirmationProbe)
  const other = site(confirmation.confirmationProbe, [
    { ...reference, digest: "hmac-sha256:" + "b".repeat(64) },
  ])
  const customerOnly = site(confirmation.confirmationProbe, [
    {
      kind: "entity",
      namespace: "customer",
      digest: "hmac-sha256:" + "c".repeat(64),
    },
  ])
  expect(
    classifyQuestionDistinction(
      [attempt, linked],
      confirmation,
      context,
      mapping,
    ),
  ).toMatchObject({ status: "observed", distinction: "same-change" })
  expect(
    classifyQuestionDistinction(
      [attempt, other],
      confirmation,
      context,
      mapping,
    ),
  ).toMatchObject({ status: "observed", distinction: "different-change" })
  expect(
    classifyQuestionDistinction(
      [attempt, customerOnly],
      confirmation,
      context,
      mapping,
    ),
  ).toMatchObject({ status: "inconclusive", reason: "missing-change-link" })
  expect(
    classifyQuestionDistinction(
      [linked, attempt],
      confirmation,
      context,
      mapping,
    ),
  ).toMatchObject({ status: "inconclusive", reason: "missing-change-link" })
  expect(
    verifyQuestionCase(confirmationCheck, mapping, "unlinked", [
      attempt,
      customerOnly,
    ]),
  ).toMatchObject({ status: "verified", reason: "unlinked-confirmation" })
})
