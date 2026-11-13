import { Context, type Effect } from "effect"
import type { ShareInvestigation } from "@flowmarkdev/core"
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
