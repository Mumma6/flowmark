import { Schema } from "effect"

const text = (length: number) =>
  Schema.String.check(
    Schema.isMaxLength(length),
    Schema.makeFilter((value) => value.trim().length > 0),
  )
export const MeaningProposalSchema = Schema.Struct({
  id: Schema.String.check(Schema.isGUID()),
  runId: Schema.String.check(Schema.isGUID()),
  path: Schema.Array(text(100)).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(5),
  ),
  label: text(120),
  reason: text(500),
})
export type MeaningProposal = typeof MeaningProposalSchema.Type
export interface StoredMeaningProposal {
  readonly command: MeaningProposal
  readonly workflow: string
  readonly revision: string
  readonly headRevision: string
  readonly codeOwned: boolean
  readonly publicationRevision: number
  readonly beforeLabel: string
  readonly unit: string | null
}
export type MeaningProposalResolution = "accepted" | "rejected"
