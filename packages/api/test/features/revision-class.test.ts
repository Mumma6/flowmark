import { describe, expect, it } from "vitest"
import type { DeployedArtifactMapping } from "@flowmarkdev/core"
import {
  classifyObservedCase,
  classifyQuestionEvidence,
  revisionClassNote,
} from "../../src/features/workflows/models/revision-class.js"

const bindingId = "00000000-0000-4000-8000-000000000010"
const digest = (digit: string) => `sha256:${digit.repeat(64)}`
const revision = (digit: string) => digit.repeat(40)

const sourceProbe = {
  probeId: "checkout.place",
  behaviorId: "checkout.place",
  behaviorRevision: "1",
  location: {
    kind: "source" as const,
    path: "src/checkout.ts",
    symbol: "checkout",
  },
}

const ambiguousProbe = {
  probeId: "checkout.review",
  behaviorId: "checkout.review",
  behaviorRevision: "1",
  location: {
    kind: "ambiguous" as const,
    candidates: [
      { path: "src/review.ts", symbol: "review" },
      { path: "src/other.ts", symbol: "other" },
    ],
  },
}

function receipt(
  deploymentId: string,
  receivedAt: string,
  probes: DeployedArtifactMapping["manifest"]["probes"],
): DeployedArtifactMapping {
  return {
    bindingId,
    deploymentId,
    environment: "fixture",
    service: "checkout",
    manifestDigest: digest("a"),
    receivedAt,
    manifest: {
      version: 1,
      repository: "example/checkout",
      revision: revision("a"),
      artifactDigest: digest("c"),
      probes,
    },
  }
}

const older = receipt("older", "2026-11-01T00:00:00.000Z", [sourceProbe])
const latest = receipt("latest", "2026-11-02T00:00:00.000Z", [
  sourceProbe,
  ambiguousProbe,
])
const tied = receipt("tied", "2026-11-02T00:00:00.000Z", [sourceProbe])
const mappings = [latest, older, tied]

describe("revision class", () => {
  it("labels the latest receipt reported-current and an older receipt historical", () => {
    expect(
      classifyObservedCase({
        deployment: latest,
        probe: sourceProbe,
        mappings,
        matchReason: "file-and-symbol",
        otherRevision: false,
      }).revisionClasses,
    ).toEqual(["reported-current"])
    expect(
      classifyObservedCase({
        deployment: older,
        probe: sourceProbe,
        mappings,
        matchReason: "file-and-symbol",
        otherRevision: false,
      }).revisionClasses,
    ).toEqual(["historical"])
  })

  it("marks a diff or rename as diff-affected and ignores ticket words", () => {
    const diff = ["--- a/src/checkout.ts", "+++ b/src/checkout.ts"].join("\n")
    expect(
      classifyObservedCase({
        deployment: latest,
        probe: sourceProbe,
        mappings,
        diff,
        matchReason: "file",
        otherRevision: false,
      }).revisionClasses,
    ).toContain("diff-affected")
    const renamed = [
      "rename from src/checkout.ts",
      "rename to src/pay.ts",
    ].join("\n")
    expect(
      classifyObservedCase({
        deployment: older,
        probe: sourceProbe,
        mappings,
        diff: renamed,
        matchReason: "rename",
        otherRevision: false,
      }).revisionClasses,
    ).toEqual(["historical", "diff-affected"])
    expect(
      classifyObservedCase({
        deployment: latest,
        probe: sourceProbe,
        mappings,
        matchReason: "lexical",
        otherRevision: false,
      }),
    ).toEqual({
      revisionClasses: ["reported-current", "mapping-uncertain"],
      behaviorClaim: null,
    })
  })

  it("keeps an ambiguous or tied-current case from being claimed as current behavior", () => {
    expect(
      classifyObservedCase({
        deployment: latest,
        probe: ambiguousProbe,
        mappings,
        diff: "+++ b/src/review.ts",
        matchReason: "file",
        strength: "ambiguous",
        otherRevision: false,
      }),
    ).toEqual({
      revisionClasses: [
        "reported-current",
        "diff-affected",
        "mapping-uncertain",
      ],
      behaviorClaim: null,
    })
  })

  it("does not turn equal arrival times into a historical ordering", () => {
    const sameTime = [latest, tied]
    expect(
      classifyObservedCase({
        deployment: latest,
        probe: sourceProbe,
        mappings: sameTime,
        matchReason: "file-and-symbol",
        otherRevision: false,
      }).revisionClasses,
    ).toEqual(["reported-current"])
    expect(
      classifyObservedCase({
        deployment: tied,
        probe: sourceProbe,
        mappings: sameTime,
        matchReason: "file-and-symbol",
        otherRevision: false,
      }).revisionClasses,
    ).toEqual(["reported-current"])
  })

  it("classifies question evidence with the same receipt and diff rules", () => {
    expect(
      classifyQuestionEvidence({
        deployment: older,
        mappings,
        probeIds: ["checkout.place"],
        diff: "+++ b/src/checkout.ts",
        requestedRevision: revision("b"),
      }),
    ).toEqual({
      revisionClasses: ["historical", "diff-affected", "mapping-uncertain"],
      behaviorClaim: null,
    })
  })

  it("describes a reported deployment and an incomplete scan without a service claim", () => {
    const note = revisionClassNote(true)
    expect(note).toContain("not a serving interval")
    expect(note).toContain("may be incomplete")
    expect(note).not.toContain("was serving")
    expect(revisionClassNote(false)).not.toContain("may be incomplete")
  })
})
