import { Match } from "effect"
import { type RevokeFeedback } from "./connection-revocation"
import type { RouterOutputs } from "../../platform/api-types"
export type ListedConnection = RouterOutputs["agentAccess"]["list"][number]

export const feedbackCopy = (feedback: RevokeFeedback) =>
  Match.value(feedback).pipe(
    Match.tag(
      "Revoked",
      () =>
        "Revoked. The next read with that grant is denied. Connect again from the client to create a new grant; this one is not restored.",
    ),
    Match.tag(
      "StillActive",
      () =>
        "Revocation did not change the stored grant. The connection is still authorized.",
    ),
    Match.tag(
      "Unknown",
      () =>
        "The response was lost. Refresh this list before revoking again. Do not assume the grant changed.",
    ),
    Match.orElse(() => null),
  )
