import { describe, expect, it } from "vitest"
import { createArtifactManifest } from "../src/artifact-manifest.js"

const source = { kind: "source", path: "examples/booking.ts", symbol: "record" }
const probe = {
  probeId: "booking-delivery",
  behaviorId: "booking.reschedule",
  behaviorRevision: "1",
  location: source,
}
const input = {
  version: 1,
  repository: "Mumma6/flowmark",
  revision: "a".repeat(40),
  artifactDigest: `sha256:${"b".repeat(64)}`,
}

describe("artifact manifest", () => {
  it("keeps identity across a source move and records a declared semantic split", () => {
    const before = createArtifactManifest({ ...input, probes: [probe] })
    const moved = createArtifactManifest({
      ...input,
      probes: [
        { ...probe, location: { ...source, path: "examples/moved.ts" } },
      ],
    })
    expect(moved.probes[0]).toEqual({
      ...before.probes[0],
      location: { ...source, path: "examples/moved.ts" },
    })
    const split = createArtifactManifest({
      ...input,
      probes: [
        { ...probe, behaviorRevision: "2" },
        {
          ...probe,
          probeId: "booking-confirmation",
          behaviorId: "booking.confirmation",
          behaviorRevision: "1",
        },
      ],
    })
    expect(
      split.probes.map(({ behaviorId, behaviorRevision }) => [
        behaviorId,
        behaviorRevision,
      ]),
    ).toEqual([
      ["booking.confirmation", "1"],
      ["booking.reschedule", "2"],
    ])
  })

  it("keeps generated and ambiguous locations explicit and canonical", () => {
    const a = { path: "a.ts", symbol: "record" }
    const b = { path: "b.ts", symbol: "record" }
    const generated = {
      ...probe,
      probeId: "generated-probe",
      location: { kind: "generated", path: "generated/booking.js" },
    }
    const ambiguous = (candidates: readonly (typeof a)[]) => ({
      ...probe,
      location: { kind: "ambiguous", candidates },
    })
    const first = createArtifactManifest({
      ...input,
      probes: [generated, ambiguous([b, a])],
    })
    const second = createArtifactManifest({
      ...input,
      probes: [ambiguous([a, b]), generated],
    })
    expect(JSON.stringify(first)).toBe(JSON.stringify(second))
    expect(first.probes).toEqual([ambiguous([a, b]), generated])
  })

  it("rejects duplicate probes and unsafe source paths", () => {
    expect(() =>
      createArtifactManifest({ ...input, probes: [probe, probe] }),
    ).toThrow()
    expect(() =>
      createArtifactManifest({
        ...input,
        probes: [
          { ...probe, location: { ...source, path: "examples/../secrets.ts" } },
        ],
      }),
    ).toThrow()
  })
})
