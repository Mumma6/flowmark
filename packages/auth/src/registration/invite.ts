import { randomBytes } from "node:crypto"
import { Effect, Option, Schema } from "effect"
import { RegistrationInvitationStore } from "@flowmark/db/persistence"
import { Email, EmailError, Mailbox } from "@flowmark/email"
import { hashInvitationToken } from "./invitation-token.js"

export const invite = Effect.fn("Registration.invite")(function* (
  input: string,
  origin: string,
) {
  const email = yield* Schema.decodeUnknownEffect(Mailbox)(
    input.trim().toLowerCase(),
  ).pipe(
    Effect.mapError(
      () =>
        new EmailError({ operation: "validation", reason: "invalid-message" }),
    ),
  )
  const delivery = yield* Email
  const invitations = yield* RegistrationInvitationStore
  const token = yield* Effect.sync(() => randomBytes(32).toString("base64url"))
  const hash = hashInvitationToken(token)
  const created = yield* invitations.create(email, hash)
  if (Option.isNone(created)) {
    return "already-invited-or-registered" as const
  }
  const actionUrl = new URL("/sign-up", origin)
  actionUrl.searchParams.set("invite", token)
  yield* delivery
    .send({
      kind: "registration-invitation",
      to: email,
      messageId: created.value.id,
      actionUrl: actionUrl.href,
      expiresInMinutes: 1440,
    })
    .pipe(
      // A failed submission can be retried with the same command. Remove only
      // this token; never remove a newer invitation or log the bearer link.
      Effect.tapError(() => invitations.remove(email, hash)),
    )
  return "invited" as const
})
