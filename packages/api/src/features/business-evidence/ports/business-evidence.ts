import { Context, type Effect } from "effect"
import type { EvidenceEngineError } from "@flowmark/evidence-engine"
import type {
  ResultDeclaration,
  SearchFields,
  BusinessInsights,
  BusinessWorkflowSummary,
  BusinessInsightsQuery,
  ReferenceJourneyQuery,
  ReferenceJourneyPage,
} from "@flowmarkdev/core"
import type {
  StoredRun,
  ListRunsQuery,
  ListedRunsPage,
  RunComparisonEvidence,
} from "../../workflows/types.js"
import type {
  PersistenceError,
  InvalidInput,
  Unauthorized,
} from "../../../errors.js"
export type BusinessEvidenceError =
  PersistenceError | InvalidInput | Unauthorized | EvidenceEngineError
export interface PublicationChoices {
  readonly declarations: readonly {
    readonly workflow: string
    readonly declaration: ResultDeclaration
  }[]
  readonly references: readonly {
    readonly workflow: string
    readonly fields: SearchFields
  }[]
}
export interface EvidenceAccess {
  readonly revision: number
  readonly publication: unknown
  readonly role: "owner" | "viewer" | "business"
  readonly choices: () => Effect.Effect<
    PublicationChoices,
    BusinessEvidenceError
  >
  readonly workflows: (
    workflow?: string,
  ) => Effect.Effect<readonly BusinessWorkflowSummary[], BusinessEvidenceError>
  readonly runs: (
    query: ListRunsQuery,
  ) => Effect.Effect<ListedRunsPage, BusinessEvidenceError>
  readonly run: (id: string) => Effect.Effect<
    | (Pick<
        StoredRun,
        | "id"
        | "workflow"
        | "status"
        | "outcome"
        | "startedAt"
        | "durationMs"
        | "result"
      > & {
        readonly definitionRevision: string | null
        readonly properties: unknown
      })
    | null,
    BusinessEvidenceError
  >
  readonly journey: (
    query: ReferenceJourneyQuery,
  ) => Effect.Effect<ReferenceJourneyPage, BusinessEvidenceError>
  readonly insights: (
    query: BusinessInsightsQuery,
  ) => Effect.Effect<BusinessInsights, BusinessEvidenceError>
  readonly comparisonEvidence: (
    id: string,
    days: number,
  ) => Effect.Effect<RunComparisonEvidence, BusinessEvidenceError>
}
export class BusinessEvidenceRepository extends Context.Service<
  BusinessEvidenceRepository,
  {
    readonly withRead: <A>(
      projectId: string,
      use: (access: EvidenceAccess) => Effect.Effect<A, BusinessEvidenceError>,
    ) => Effect.Effect<A, BusinessEvidenceError>
    readonly configuration: (
      userId: string,
      projectId: string,
    ) => Effect.Effect<
      {
        readonly revision: number
        readonly publication: unknown
        readonly choices: PublicationChoices
      },
      BusinessEvidenceError
    >
    readonly replace: (
      userId: string,
      projectId: string,
      expectedRevision: number,
      publication: unknown,
      validate: (
        choices: PublicationChoices,
      ) => Effect.Effect<void, BusinessEvidenceError>,
    ) => Effect.Effect<
      { readonly revision: number; readonly publication: unknown },
      BusinessEvidenceError
    >
  }
>()("@flowmark/api/BusinessEvidenceRepository") {}
