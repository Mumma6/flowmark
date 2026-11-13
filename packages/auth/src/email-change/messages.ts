import { Effect } from "effect"
import type { EmailMessage } from "@flowmark/email"
import type { EmailChangeRecord } from "@flowmark/db/persistence"
import { AccountEmailError, AccountEmailRuntime } from "./types.js"

export const emailChangeProofUrl = (
  baseURL: string,
  id: string,
  token: string,
) => {
  const url = new URL("/api/auth/email-change/verify", baseURL)
  url.searchParams.set("request", id)
  url.searchParams.set("token", token)
  return url.href
}
export const emailChangeNotice = (record: EmailChangeRecord): EmailMessage => ({
  kind: "security-notice",
  event: "email-changed",
  to: record.data.fromEmail,
  messageId: record.id,
})
export const deliverEmailChange = Effect.fn("EmailChange.deliver")(function* (
  message: EmailMessage,
) {
  const runtime = yield* AccountEmailRuntime
  if (!runtime.delivery) {
    return yield* new AccountEmailError({ reason: "Unavailable" })
  }
  return yield* runtime.delivery
    .send(message)
    .pipe(
      Effect.mapError(
        (cause) => new AccountEmailError({ reason: "DeliveryFailed", cause }),
      ),
    )
})
