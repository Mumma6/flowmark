import {
  Array as EffectArray,
  Data,
  Effect,
  Match,
  Result,
  Schema,
} from "effect"

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
    return "No authenticated request recorded"
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

export type OwnedConnectionView = Data.TaggedEnum<{
  Hidden: Record<never, never>
  Owned: Record<never, never>
  Loading: Record<never, never>
  UnavailableToAccount: Record<never, never>
  Unavailable: Record<never, never>
}>

export const OwnedConnection = Data.taggedEnum<OwnedConnectionView>()

export const interpretOwnedConnection = (input: {
  readonly listed: boolean
  readonly detail: "pending" | "present" | "absent" | "unavailable"
}): OwnedConnectionView =>
  Match.value(input).pipe(
    Match.when({ listed: false }, () => OwnedConnection.Hidden()),
    Match.when({ detail: "pending" }, () => OwnedConnection.Loading()),
    Match.when({ detail: "unavailable" }, () => OwnedConnection.Unavailable()),
    Match.when({ detail: "absent" }, () =>
      OwnedConnection.UnavailableToAccount(),
    ),
    Match.orElse(() => OwnedConnection.Owned()),
  )

export type RevokeFeedback = Data.TaggedEnum<{
  Idle: Record<never, never>
  Pending: Record<never, never>
  Revoked: Record<never, never>
  StillActive: Record<never, never>
  Unknown: Record<never, never>
}>

export const RevokeFeedbackState = Data.taggedEnum<RevokeFeedback>()

/** Success is the persisted absence of the connection, not the mutation response alone. */
export const interpretRevokeResult = (input: {
  readonly stillListed: boolean | "unknown"
}): RevokeFeedback =>
  Match.value(input.stillListed).pipe(
    Match.when("unknown", () => RevokeFeedbackState.Unknown()),
    Match.when(false, () => RevokeFeedbackState.Revoked()),
    Match.orElse(() => RevokeFeedbackState.StillActive()),
  )

export type ConnectionListRecovery = Data.TaggedEnum<{
  Unavailable: { readonly message: string }
  StaleSession: { readonly message: string }
}>

export const ConnectionList = Data.taggedEnum<ConnectionListRecovery>()
const connectionsUnavailable =
  "Connections could not be read. Retry before revoking anything."

export const connectionListRecovery = (error: unknown) =>
  Schema.decodeUnknownResult(
    Schema.Struct({ data: Schema.Struct({ code: Schema.String }) }),
  )(error).pipe(
    Result.match({
      onFailure: () =>
        ConnectionList.Unavailable({ message: connectionsUnavailable }),
      onSuccess: ({ data }) =>
        data.code === "UNAUTHORIZED" || data.code === "FORBIDDEN"
          ? ConnectionList.StaleSession({
              message:
                "This Studio session has ended. Sign in again before inspecting or revoking a connection.",
            })
          : ConnectionList.Unavailable({ message: connectionsUnavailable }),
    }),
  )

class ConnectionRequestError extends Data.TaggedError(
  "ConnectionRequestError",
)<{
  readonly operation: "revoke" | "confirm"
  readonly cause: unknown
}> {}

type ConnectionReference = {
  readonly clientId: string
  readonly authorizationCodeId: string
}
type ConnectionObservation = {
  readonly target: ConnectionReference
  readonly cancelRead: () => Promise<void>
  readonly read: () => Promise<readonly ConnectionReference[]>
}

/** Cancel older polls so only a newly requested server response can confirm. */
export const confirmConnectionRevocation = Effect.fn(
  "Connect.confirmRevocation",
)(function* (input: ConnectionObservation) {
  const observed = yield* Effect.result(
    Effect.gen(function* () {
      yield* Effect.tryPromise({
        try: input.cancelRead,
        catch: (cause) =>
          new ConnectionRequestError({ operation: "confirm", cause }),
      })
      return yield* Effect.tryPromise({
        try: input.read,
        catch: (cause) =>
          new ConnectionRequestError({ operation: "confirm", cause }),
      })
    }),
  )
  return interpretRevokeResult({
    stillListed: Result.match(observed, {
      onFailure: () => "unknown" as const,
      onSuccess: (connections) =>
        EffectArray.some(
          connections,
          (item) =>
            item.clientId === input.target.clientId &&
            item.authorizationCodeId === input.target.authorizationCodeId,
        ),
    }),
  })
})

/** A lost mutation response still requires a fresh server observation. */
export const revokeAndConfirmConnection = Effect.fn("Connect.revokeAndConfirm")(
  function* (
    input: ConnectionObservation & { readonly revoke: () => Promise<unknown> },
  ) {
    // The authoritative follow-up read decides the outcome, even after a lost reply.
    yield* Effect.result(
      Effect.tryPromise({
        try: input.revoke,
        catch: (cause) =>
          new ConnectionRequestError({ operation: "revoke", cause }),
      }),
    )
    return yield* confirmConnectionRevocation(input)
  },
)
