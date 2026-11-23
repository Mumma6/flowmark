import { Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  EvidenceEstateInputSchema,
  reconcileEvidenceBoundaries,
  type SourceBoundary,
} from "../src/evidence-estate.js"

const revision = "a".repeat(40)
const nextRevision = "b".repeat(40)

const source = (
  overrides: Partial<SourceBoundary> & Pick<SourceBoundary, "id" | "kind">,
): SourceBoundary => ({
  runtime: "node",
  path: `src/${overrides.id}.ts`,
  symbol: overrides.id,
  revision,
  attestingSignal: "none",
  consequence: "ordinary",
  frequency: "common",
  access: "readable",
  generated: false,
  policy: "included",
  ambiguous: false,
  ...overrides,
})

const deployed = (
  id: string,
  kind: SourceBoundary["kind"],
  provenance:
    "deployment-manifest" | "independent-inventory" = "deployment-manifest",
) => ({
  id,
  kind,
  runtime: "node" as const,
  path: `src/${id}.ts`,
  symbol: id,
  revision,
  service: "worker",
  provenance,
  generated: false,
  ambiguous: false,
})

describe("evidence boundary discovery", () => {
  it("reconciles a renamed route, a deployed-only worker, an ambiguous event, an inaccessible service and a sufficient signal", () => {
    const previous = [
      source({
        id: "booking.route",
        kind: "request",
        runtime: "next",
        path: "app/bookings/route.ts",
        symbol: "POST",
      }),
    ]
    const current = [
      source({
        id: "booking.route",
        kind: "request",
        runtime: "next",
        path: "app/reservations/route.ts",
        symbol: "POST",
        attestingSignal: "existing-probe",
      }),
      source({
        id: "payment.receipt",
        kind: "domain-event",
        path: "src/payments/receipt.ts",
        symbol: "onReceipt",
        attestingSignal: "receipt",
      }),
      source({
        id: "slot.released",
        kind: "domain-event",
        path: "src/slots/events.ts",
        symbol: "SlotReleased",
        ambiguous: true,
      }),
      source({
        id: "ledger.hidden",
        kind: "worker",
        path: "src/ledger/worker.ts",
        symbol: "post",
        access: "inaccessible",
      }),
      source({
        id: "booking.compensate",
        kind: "compensation",
        path: "src/bookings/compensate.ts",
        symbol: "compensate",
        consequence: "costly",
        frequency: "rare",
        attestingSignal: "outbox",
      }),
      source({
        id: "legacy.job",
        kind: "worker",
        runtime: "other",
        path: "jobs/legacy.rb",
        symbol: "perform",
      }),
      source({
        id: "debug.payload",
        kind: "request",
        path: "app/debug/route.ts",
        symbol: "GET",
        policy: "excluded",
      }),
      source({
        id: "generated.handler",
        kind: "request",
        path: "app/generated/route.ts",
        symbol: "POST",
        generated: true,
        access: "partial",
      }),
    ]
    const estate = reconcileEvidenceBoundaries(
      Schema.decodeUnknownSync(EvidenceEstateInputSchema)({
        source: current,
        deployed: [
          deployed("booking.route", "request"),
          deployed("payment.receipt", "domain-event"),
          {
            ...deployed("email.worker", "worker", "independent-inventory"),
            path: "src/email/worker.ts",
            symbol: "deliver",
          },
        ],
        previous,
      }),
    )

    expect(estate.telemetry).toBe("not-read")
    expect(estate.boundaries.map((item) => item.id)[0]).toBe(
      "booking.compensate",
    )
    expect(estate.boundaries[0]).toMatchObject({
      status: "source-only",
      basis: "source-inference",
      observedCases: null,
      attestingSignal: "outbox",
    })
    expect(estate.boundaries[0]?.reason).toContain("costly")
    expect(estate.boundaries[0]?.reason).toContain("outbox")

    const byId = (id: string) =>
      estate.boundaries.find((item) => item.id === id)
    expect(byId("booking.route")).toMatchObject({
      status: "matched",
      revisionChange: "moved",
      sufficientSignal: true,
      provenance: ["source-registration", "deployment-manifest"],
    })
    expect(byId("payment.receipt")).toMatchObject({
      status: "matched",
      sufficientSignal: true,
      revisionChange: "added",
    })
    expect(byId("slot.released")).toMatchObject({
      ambiguous: true,
      revisionChange: "unresolved",
      observedCases: null,
    })
    expect(byId("ledger.hidden")).toMatchObject({
      access: "inaccessible",
      revisionChange: "unresolved",
      observedCases: null,
    })
    expect(byId("email.worker")).toMatchObject({
      status: "deployed-only",
      basis: "deployment-inventory",
      observedCases: null,
      revisionChange: "unresolved",
    })
    expect(byId("legacy.job")?.status).toBe("unsupported")
    expect(byId("debug.payload")?.status).toBe("policy-excluded")
    expect(byId("generated.handler")).toMatchObject({
      generated: true,
      access: "partial",
      status: "source-only",
    })
    expect(estate.revision).toEqual({
      compared: true,
      added: ["booking.compensate", "generated.handler", "payment.receipt"],
      moved: ["booking.route"],
      unresolved: [
        "debug.payload",
        "email.worker",
        "ledger.hidden",
        "legacy.job",
        "slot.released",
      ],
    })
    expect(JSON.stringify(estate)).not.toContain(nextRevision)
    expect(current[0]?.path).toBe("app/reservations/route.ts")
  })
})
