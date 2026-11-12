import { Context, type Effect, type Option } from "effect"
import type {
  SaveInvestigation,
  SavedInvestigationList,
} from "@flowmarkdev/core"
import type {
  InvalidInput,
  PersistenceError,
  Unauthorized,
} from "../../../errors.js"

export interface StoredInvestigation {
  readonly id: string
  readonly title: string
  readonly selection: unknown
  readonly createdAt: string
}
type Failure = InvalidInput | PersistenceError | Unauthorized
export interface InvestigationsService {
  readonly save: (
    userId: string,
    projectId: string,
    input: SaveInvestigation,
  ) => Effect.Effect<StoredInvestigation, Failure>
  readonly get: (
    userId: string,
    projectId: string,
    id: string,
  ) => Effect.Effect<Option.Option<StoredInvestigation>, Failure>
  readonly list: (
    userId: string,
    projectId: string,
    input: SavedInvestigationList,
  ) => Effect.Effect<
    {
      readonly items: readonly StoredInvestigation[]
      readonly nextCursor: string | null
    },
    Failure
  >
  readonly delete: (
    userId: string,
    projectId: string,
    id: string,
  ) => Effect.Effect<{ readonly deleted: boolean }, Failure>
}
export class Investigations extends Context.Service<
  Investigations,
  InvestigationsService
>()("@flowmark/api/Investigations") {}
