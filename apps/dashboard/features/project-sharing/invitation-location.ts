import { Result, Schema } from "effect"
const Uuid =
  "[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"
export const InvitationReturnPath = Schema.String.check(
  Schema.isPattern(
    new RegExp(`^/invitations/${Uuid}\\?token=[A-Za-z0-9_-]{43}$`),
  ),
)
/** Only a local invitation route with its bounded proof can cross the auth return boundary. */
export const invitationReturnPath = (value: unknown) =>
  Result.match(Schema.decodeUnknownResult(InvitationReturnPath)(value), {
    onFailure: () => undefined,
    onSuccess: (value) => value,
  })
export const invitationPath = (id: string, token: string) =>
  invitationReturnPath(`/invitations/${id}?token=${token}`)
export const authReturnPath = (value: unknown) =>
  typeof value === "string" && value.startsWith("/connect/agent/consent?")
    ? value
    : invitationReturnPath(value)
