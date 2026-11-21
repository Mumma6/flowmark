import { Context, type Effect } from "effect"
import type {
  MeaningProposalResolution,
  StoredMeaningProposal,
  ShareInvestigation,
} from "@flowmarkdev/core"
import type {
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"
import type { PublicationChoices } from "../../business-evidence/ports/business-evidence.js"
export type SharedInvestigationFailure =
  InvalidInput | PersistenceError | Unauthorized
export interface StoredSharedInvestigation {
  readonly id: string
  readonly creatorId: string
  readonly title: string
  readonly createdAt: string
  readonly selection: unknown
}
export interface SharedQuestionAccess {
  readonly role: "owner" | "viewer" | "business"
  readonly userId: string
  readonly revision: number
  readonly publication: unknown
  readonly choices: () => Effect.Effect<
    PublicationChoices,
    SharedInvestigationFailure
  >
  readonly proposalExample: (id: string) => Effect.Effect<
    {
      workflow: string
      definitionRevision: string | null
      result: unknown
    } | null,
    SharedInvestigationFailure
  >
  readonly proposalHead: (
    workflow: string,
  ) => Effect.Effect<
    { revision: string; source: string | null } | null,
    SharedInvestigationFailure
  >
  readonly proposals: (id?: string) => Effect.Effect<
    readonly {
      id: string
      creatorId: string
      proposal: StoredMeaningProposal | null
      resolution: MeaningProposalResolution | null
    }[],
    SharedInvestigationFailure
  >
  readonly submitProposal: (
    proposal: StoredMeaningProposal,
  ) => Effect.Effect<{ id: string }, SharedInvestigationFailure>
  readonly resolveProposal: (
    id: string,
    resolution: MeaningProposalResolution,
  ) => Effect.Effect<
    { id: string; resolution: MeaningProposalResolution },
    SharedInvestigationFailure
  >
  readonly records: () => Effect.Effect<
    readonly StoredSharedInvestigation[],
    SharedInvestigationFailure
  >
  readonly create: (
    input: ShareInvestigation,
  ) => Effect.Effect<string, SharedInvestigationFailure>
  readonly revoke: (
    id: string,
  ) => Effect.Effect<{ readonly revoked: true }, SharedInvestigationFailure>
}
export class SharedInvestigations extends Context.Service<
  SharedInvestigations,
  {
    readonly withAccess: <A>(
      projectId: string,
      write: boolean,
      use: (
        access: SharedQuestionAccess,
      ) => Effect.Effect<A, SharedInvestigationFailure>,
    ) => Effect.Effect<A, SharedInvestigationFailure>
  }
>()("@flowmark/api/SharedInvestigations") {}
