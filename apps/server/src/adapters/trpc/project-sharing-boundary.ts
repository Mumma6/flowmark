import { createHmac } from "node:crypto"
import { Effect, Redacted } from "effect"
import { Email, resendLayer } from "@flowmark/email"
import { readAuthSecret } from "@flowmark/auth"
import {
  ProjectInvitationDelivery,
  ProjectSharingIdentity,
  PersistenceError,
  Unauthorized,
} from "@flowmark/api"
import { getAuth } from "../../auth"
import { serverOrigins } from "../../server-env"
import { lifecycleReauthentication } from "./lifecycle-reauthentication"

const failure = (cause: unknown) =>
  new PersistenceError({ operation: "project-sharing", cause })
export const sharingIdentity = (
  request: Request,
): ProjectSharingIdentity["Service"] => ({
  current: Effect.gen(function* () {
    if (
      request.headers.has("authorization") ||
      request.headers.has("x-flowmark-grant-client-id")
    ) {
      return yield* new Unauthorized({ permission: "read" })
    }
    const auth = yield* getAuth().pipe(Effect.mapError(failure))
    const actor = yield* Effect.tryPromise({
      try: () =>
        auth.api.getSession({
          headers: request.headers,
          query: { disableCookieCache: true, disableRefresh: true },
        }),
      catch: failure,
    })
    if (!actor) {
      return yield* new Unauthorized({ permission: "read" })
    }
    return { userId: actor.user.id, sessionId: actor.session.id }
  }),
  confirm: lifecycleReauthentication(request).verify,
})
export const sharingNotifications =
  (): ProjectInvitationDelivery["Service"] => ({
    recipientKey: (email) =>
      readAuthSecret().pipe(
        Effect.map((secret) =>
          createHmac("sha256", secret)
            .update(JSON.stringify(["project-sharing-recipient-v1", email]))
            .digest("hex"),
        ),
        Effect.mapError(failure),
      ),
    send: Effect.fn("ProjectSharing.sendInvitation")(
      function* (message, token) {
        const { dashboardOrigin } = yield* serverOrigins().pipe(
          Effect.mapError(failure),
        )
        const email = yield* Email.pipe(
          Effect.provide(
            resendLayer({ ...process.env, BETTER_AUTH_URL: dashboardOrigin }),
          ),
          Effect.mapError(failure),
        )
        const url = new URL(`/invitations/${message.id}`, dashboardOrigin)
        url.searchParams.set("token", Redacted.value(token))
        yield* email
          .send({
            kind: "project-invitation",
            role: message.role,
            to: message.email,
            messageId: message.id,
            projectName: message.projectName,
            inviterName: message.inviterName.slice(0, 80),
            actionUrl: url.href,
          })
          .pipe(Effect.mapError(failure))
      },
    ),
  })
