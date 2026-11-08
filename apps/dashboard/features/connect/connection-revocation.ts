import { Array as EffectArray, Match, Result, Schema } from "effect"

const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

/** Day resolution in UTC. An exact clock is not a live agent. */
export const coarsenLastAuthenticated = (value: string | null) => {
  if (value === null) {
    return "No authenticated read recorded"
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) {
    return "Last authenticated request time is unavailable"
  }
  const date = new Date(parsed)
  const month = months[date.getUTCMonth()] ?? "UTC"
  return `Last authenticated request on ${date.getUTCDate()} ${month} ${date.getUTCFullYear()} (UTC)`
}

export const connectionProjectLabels = (
  projectIds: readonly string[],
  names: Readonly<Record<string, string>>,
) =>
  EffectArray.map(
    projectIds,
    (id) => names[id.toLowerCase()] ?? "Former project",
  )

export type OwnedConnectionView =
  | { readonly _tag: "Hidden" }
  | { readonly _tag: "Owned" }
  | { readonly _tag: "UnavailableToAccount" }
  | { readonly _tag: "Unavailable" }

export const interpretOwnedConnection = (input: {
  readonly listed: boolean
  readonly detail: "present" | "absent" | "unavailable"
}): OwnedConnectionView =>
  Match.value(input).pipe(
    Match.when({ detail: "unavailable" }, () => ({
      _tag: "Unavailable" as const,
    })),
    Match.when({ detail: "absent" }, () => ({
      _tag: "UnavailableToAccount" as const,
    })),
    Match.when({ listed: false }, () => ({ _tag: "Hidden" as const })),
    Match.orElse(() => ({ _tag: "Owned" as const })),
  )

export type RevokeFeedback =
  | { readonly _tag: "Idle" }
  | { readonly _tag: "Pending" }
  | { readonly _tag: "Revoked" }
  | { readonly _tag: "StillActive" }
  | { readonly _tag: "Unknown" }

/** Success is the persisted absence of the connection, not the mutation response alone. */
export const interpretRevokeResult = (input: {
  readonly mutation: "succeeded" | "failed"
  readonly stillListed: boolean | "unknown"
}): RevokeFeedback =>
  Match.value(input.stillListed).pipe(
    Match.when("unknown", () => ({ _tag: "Unknown" as const })),
    Match.when(false, () => ({ _tag: "Revoked" as const })),
    Match.orElse(() => ({ _tag: "StillActive" as const })),
  )

export const connectionListRecovery = (error: unknown) =>
  Schema.decodeUnknownResult(
    Schema.Struct({ data: Schema.Struct({ code: Schema.String }) }),
  )(error).pipe(
    Result.match({
      onFailure: () =>
        ({
          _tag: "Unavailable" as const,
          message:
            "Connections could not be read. Retry before revoking anything.",
        }) as const,
      onSuccess: ({ data }) =>
        data.code === "UNAUTHORIZED" || data.code === "FORBIDDEN"
          ? ({
              _tag: "StaleSession" as const,
              message:
                "This Studio session has ended. Sign in again before inspecting or revoking a connection.",
            } as const)
          : ({
              _tag: "Unavailable" as const,
              message:
                "Connections could not be read. Retry before revoking anything.",
            } as const),
    }),
  )
