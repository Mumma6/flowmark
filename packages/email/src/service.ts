import { Context, Effect } from "effect"
import type { EmailError } from "./errors.js"

export interface EmailSubmission {
  readonly status: "submitted"
  readonly providerId: string
}

export class Email extends Context.Service<
  Email,
  {
    readonly send: (
      message: unknown,
    ) => Effect.Effect<EmailSubmission, EmailError>
  }
>()("@flowmark/email/Email") {}
