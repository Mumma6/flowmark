import { Context, Data, Effect, Layer } from "effect"
import { Email, resendLayer } from "@flowmark/email"

export class WaitlistWelcomeError extends Data.TaggedError(
  "WaitlistWelcomeError",
)<{
  readonly reason: "delivery" | "retry-window-expired"
}> {}

export class WaitlistWelcomeEmail extends Context.Service<
  WaitlistWelcomeEmail,
  {
    readonly send: (
      to: string,
      messageId: string,
    ) => Effect.Effect<void, WaitlistWelcomeError>
  }
>()("@flowmark/api/WaitlistWelcomeEmail") {}

export const WaitlistWelcomeEmailLive = Layer.succeed(WaitlistWelcomeEmail, {
  send: (to, messageId) =>
    Email.use((email) =>
      email.send({ kind: "waitlist-welcome", to, messageId }),
    ).pipe(
      Effect.provide(resendLayer(process.env)),
      Effect.asVoid,
      Effect.mapError(() => new WaitlistWelcomeError({ reason: "delivery" })),
    ),
})
