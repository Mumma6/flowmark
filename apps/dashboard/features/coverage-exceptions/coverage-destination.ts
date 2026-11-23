import { Match, Schema } from "effect"

export const CoverageStatusSchema = Schema.Literals([
  "unavailable",
  "waiting",
  "stale",
  "revoked",
  "forbidden",
])
export type CoverageStatus = typeof CoverageStatusSchema.Type

const QuestionId = Schema.String.check(
  Schema.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/),
)
const RepairUrl = Schema.String.check(
  Schema.isPattern(
    /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/[1-9][0-9]{0,8}$/,
  ),
)

const copy = {
  unavailable: {
    title: "Unavailable",
    explanation: "The read is unavailable. No production fact is shown.",
  },
  waiting: {
    title: "Waiting",
    explanation:
      "Eligible traffic has not matured. Waiting does not add capture.",
  },
  stale: {
    title: "Stale",
    explanation:
      "The mapping or fixture is stale, so the question stays unresolved.",
  },
  revoked: {
    title: "Revoked",
    explanation: "The grant is revoked. This view shows no case.",
  },
  forbidden: {
    title: "Forbidden",
    explanation: "This grant cannot read the case.",
  },
} as const

export function coverageDestination(input: {
  readonly status?: string
  readonly question?: string
  readonly repair?: string
}) {
  const status = Schema.decodeUnknownOption(CoverageStatusSchema)(input.status)
  const question = Schema.decodeUnknownOption(QuestionId)(input.question)
  const repair = Schema.decodeUnknownOption(RepairUrl)(input.repair)
  return Match.value(status).pipe(
    Match.tag("None", () => ({
      status: null,
      question: null,
      title: "Coverage and exceptions",
      explanation:
        "Choose a question to see whether it is unavailable, waiting, stale, revoked or forbidden.",
      action: { href: "/connect", label: "Review connections and policy" },
    })),
    Match.tag("Some", ({ value }) => ({
      status: value,
      question: question._tag === "Some" ? question.value : null,
      title: copy[value].title,
      explanation: copy[value].explanation,
      action:
        repair._tag === "Some" && value !== "revoked" && value !== "forbidden"
          ? { href: repair.value, label: "Open the repair pull request" }
          : { href: "/connect", label: "Review access" },
    })),
    Match.exhaustive,
  )
}
