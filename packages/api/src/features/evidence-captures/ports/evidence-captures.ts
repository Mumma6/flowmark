import { Context, type Effect } from "effect"
import type { CapturedRunEvidence } from "@flowmarkdev/core"
import type {
  BusinessEvidenceError,
  PublicationChoices,
} from "../../business-evidence/ports/business-evidence.js"
import type { BusinessRunSummary } from "@flowmarkdev/core"
export type CaptureFailure = BusinessEvidenceError
export interface CaptureRecord {
  readonly id: string
  readonly sourceRunId: string
  readonly creatorId: string
  readonly capturedAt: string
  readonly expiresAt: string
  readonly reason: "Expired" | "PublicationChanged" | "SourceMissing" | null
}
export interface CaptureAccess {
  readonly role: "owner" | "viewer" | "business"
  readonly userId: string
  readonly revision: number
  readonly publication: unknown
  readonly choices: () => Effect.Effect<PublicationChoices, CaptureFailure>
  readonly records: () => Effect.Effect<
    readonly CaptureRecord[],
    CaptureFailure
  >
  readonly payload: (id: string) => Effect.Effect<unknown, CaptureFailure>
  readonly source: (id: string) => Effect.Effect<
    BusinessRunSummary & {
      readonly definitionRevision: string | null
      readonly capturedAt: string
      readonly expiresAt: string
    },
    CaptureFailure
  >
  readonly values: (
    id: string,
    paths: readonly (readonly string[])[],
    keys: readonly string[],
  ) => Effect.Effect<
    {
      readonly values: readonly unknown[]
      readonly references: readonly { key: string; value: string }[]
    },
    CaptureFailure
  >
  readonly create: (
    capture: CapturedRunEvidence,
  ) => Effect.Effect<{ readonly id: string }, CaptureFailure>
  readonly delete: (
    id: string,
  ) => Effect.Effect<{ readonly deleted: true }, CaptureFailure>
}
export class EvidenceCaptures extends Context.Service<
  EvidenceCaptures,
  {
    readonly withAccess: <A>(
      projectId: string,
      write: boolean,
      use: (access: CaptureAccess) => Effect.Effect<A, CaptureFailure>,
    ) => Effect.Effect<A, CaptureFailure>
  }
>()("@flowmark/api/EvidenceCaptures") {}
export class EvidenceCaptureAdmission extends Context.Service<
  EvidenceCaptureAdmission,
  { readonly local: () => Effect.Effect<boolean, CaptureFailure> }
>()("@flowmark/api/EvidenceCaptureAdmission") {}
