import type { ResultDeclaration, SearchFields } from "@flowmarkdev/core"
import { Array } from "effect"

export const DATASET = "meridian-health-v1"
export const ACCOUNT_EMAIL = "flowmark.dev@gmail.com"
export const ACCOUNT_NAME = "Meridian Health (Staging)"
export const PROJECT_NAME = "Meridian Health"
export const providers = [
  "northstar-care",
  "cedar-health",
  "harbor-clinics",
] as const
export const clinics = [
  {
    id: "northstar-river",
    provider: providers[0],
    scheduler: "atlas-scheduling",
    referrals: "northstar-referrals",
    laboratory: "aurora-labs",
  },
  {
    id: "northstar-meadow",
    provider: providers[0],
    scheduler: "atlas-scheduling",
    referrals: "northstar-referrals",
    laboratory: "aurora-labs",
  },
  {
    id: "cedar-grove",
    provider: providers[1],
    scheduler: "orbit-scheduling",
    referrals: "cedar-connect",
    laboratory: "beacon-labs",
  },
  {
    id: "cedar-hill",
    provider: providers[1],
    scheduler: "orbit-scheduling",
    referrals: "cedar-connect",
    laboratory: "beacon-labs",
  },
  {
    id: "harbor-quay",
    provider: providers[2],
    scheduler: "atlas-scheduling",
    referrals: "harbor-link",
    laboratory: "aurora-labs",
  },
  {
    id: "harbor-bay",
    provider: providers[2],
    scheduler: "orbit-scheduling",
    referrals: "harbor-link",
    laboratory: "beacon-labs",
  },
] as const
export type Clinic = (typeof clinics)[number]
export const workflowNames = [
  "referral.ingest",
  "patient.match",
  "appointment.book",
  "lab-results.sync",
  "notification.dispatch",
  "integration.health-check",
] as const
export type WorkflowName = (typeof workflowNames)[number]

export const searchFields: SearchFields = [
  { key: "referralRef", role: "lookup" },
  { key: "patientRef", role: "lookup" },
  { key: "bookingRef", role: "lookup" },
  { key: "batchRef", role: "lookup" },
  { key: "provider", role: "dimension", values: [...providers] },
  {
    key: "clinic",
    role: "dimension",
    values: Array.map(clinics, (clinic) => clinic.id),
  },
  {
    key: "integration",
    role: "dimension",
    values: [
      "atlas-scheduling",
      "orbit-scheduling",
      "northstar-referrals",
      "cedar-connect",
      "harbor-link",
      "aurora-labs",
      "beacon-labs",
      "meridian-notify",
    ],
  },
]

const count = (key: string): ResultDeclaration["fields"][number] => ({
  path: [key],
  label: key,
  kind: "count",
  aggregate: true,
  unit: "records",
})
const declarations: Record<WorkflowName, readonly string[]> = {
  "referral.ingest": [
    "received",
    "accepted",
    "rejected",
    "review",
    "duplicates",
  ],
  "patient.match": ["checked", "matched", "ambiguous", "unmatched", "invalid"],
  "appointment.book": [
    "requested",
    "confirmed",
    "unavailable",
    "pending",
    "conflicts",
  ],
  "lab-results.sync": ["received", "synchronized", "rejected", "delayed"],
  "notification.dispatch": ["requested", "delivered", "rejected", "pending"],
  "integration.health-check": ["checked", "reachable", "unavailable"],
}
export const resultDeclaration = (
  workflow: WorkflowName,
): ResultDeclaration => ({
  revision: "meridian-v1",
  fields: [
    ...Array.map(declarations[workflow], count),
    {
      path: ["reasons"],
      label: "Reported reasons",
      kind: "reasons",
      aggregate: true,
      values: [
        "missing_clinic",
        "missing_contact",
        "duplicate_reference",
        "manual_review",
        "ambiguous_match",
        "no_match",
        "validation_failure",
        "no_availability",
        "booking_conflict",
        "invalid_result",
        "awaiting_result",
        "destination_rejected",
        "awaiting_ack",
      ],
    },
  ],
})

export const phase = (day: number) => {
  if (day <= 10) {
    return "baseline"
  }
  if (day <= 17) {
    return "degradation"
  }
  if (day <= 23) {
    return "data-quality"
  }
  return "recovery"
}
