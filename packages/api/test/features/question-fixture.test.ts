import type { StoredRuntimeObservation } from "@flowmarkdev/core"
import { RuntimeQuestionCheckSchema } from "@flowmarkdev/core"
import { Schema } from "effect"
import { expect, it } from "vitest"
import declaration from "../../../../examples/questions/committed-receipt.json"
import { verifyQuestionCase } from "../../src/features/workflows/rules/assess-question-fixture.js"

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
  references = [reference],
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
