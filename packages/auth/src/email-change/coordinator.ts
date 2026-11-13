import { randomBytes } from "node:crypto"
import {
  Array,
  Context,
  Effect,
  Layer,
  Option,
  Redacted,
  Ref,
  Result,
  Schema,
} from "effect"
import type { EmailMessage } from "@flowmark/email"
import {
  AccountEmailChangeStore,
  Database,
  hashApiKey,
  revokeAllAgentAccessConnectionsForUser,
  type EmailChangeRecord,
  type EmailChangeResult,
} from "@flowmark/db/persistence"
import {
  AccountEmailError,
  AccountEmailRuntime,
  type ProofCallbacks,
} from "./types.js"
import {
  emailActor,
  emailBudget,
  emailProviderCall,
  verifyEmailChangePassword,
} from "./provider.js"
import {
  deliverEmailChange,
  emailChangeNotice,
  emailChangeProofUrl,
} from "./messages.js"

const NewEmail = Schema.String.check(
  Schema.isMaxLength(254),
  Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
)
const safeView = (record: EmailChangeRecord) => ({
  id: record.id,
  toEmail: record.data.toEmail,
  step: record.data.step,
  delivery:
    record.data.step === "confirm-old" && record.data.delivery === "submitted"
      ? "pending"
      : record.data.delivery,
  expiresAt: record.expiresAt.toISOString(),
})
const noCallbacks: ProofCallbacks = {
  old: () => Promise.reject(new Error("Unexpected old email proof callback")),
  next: () => Promise.reject(new Error("Unexpected new email proof callback")),
}

export class AccountEmailChange extends Context.Service<AccountEmailChange>()(
  "@flowmark/auth/AccountEmailChange",
  {
    make: Effect.gen(function* () {
      const runtime = yield* AccountEmailRuntime
      const receiptCookie = `${new URL(runtime.baseURL).protocol === "https:" ? "__Secure-" : ""}flowmark.email-change-result`
      const store = yield* AccountEmailChangeStore
      const requireDelivery = Effect.fn("EmailChange.requireDelivery")(
        function* () {
          if (!runtime.delivery) {
            return yield* new AccountEmailError({ reason: "Unavailable" })
          }
        },
      )
      const markDelivery = Effect.fn("EmailChange.markDelivery")(function* (
        record: EmailChangeRecord,
        delivery: "submitted" | "failed",
      ) {
        yield* store.withAccount(record.data.userId, (tx) =>
          Effect.gen(function* () {
            const current = yield* tx.get(record.id)
            // A delivery acknowledgement must not overwrite a later proof stage.
            if (
              current.data.step !== record.data.step ||
              current.data.oldTokenHash !== record.data.oldTokenHash ||
              current.data.newTokenHash !== record.data.newTokenHash
            ) {
              return
            }
            yield* tx.save({ ...current, data: { ...current.data, delivery } })
          }),
        )
      })
      const sendAfterCommit = Effect.fn("EmailChange.sendAfterCommit")(
        function* (
          record: EmailChangeRecord,
          messages: ReadonlyArray<EmailMessage>,
        ) {
          if (messages.length === 0) {
            return
          }
          const result = yield* Effect.forEach(messages, deliverEmailChange, {
            discard: true,
          }).pipe(Effect.result)
          const delivery = Result.match(result, {
            onFailure: () => "failed" as const,
            onSuccess: () => "submitted" as const,
          })
          yield* markDelivery(record, delivery)
          return yield* Result.match(result, {
            onFailure: Effect.fail,
            onSuccess: () => Effect.void,
          })
        },
      )
      const request = Effect.fn("EmailChange.request")(function* (
        headers: Headers,
        input: {
          readonly currentSessionId: string
          readonly newEmail: string
          readonly password: Redacted.Redacted<string>
        },
      ) {
        yield* requireDelivery()
        const actor = yield* emailActor(headers, input.currentSessionId)
        if (!actor.user.emailVerified) {
          return yield* new AccountEmailError({ reason: "NeedsVerification" })
        }
        const newEmail = yield* Schema.decodeUnknownEffect(NewEmail)(
          input.newEmail.trim().toLowerCase(),
        ).pipe(
          Effect.mapError(
            () => new AccountEmailError({ reason: "InvalidInput" }),
          ),
        )
        if (newEmail === actor.user.email.toLowerCase()) {
          return yield* new AccountEmailError({ reason: "InvalidInput" })
        }
        yield* verifyEmailChangePassword(headers, actor.user.id, input.password)
        yield* emailBudget(`email-change-request:${actor.user.id}`, 3)
        yield* store.prune()
        const submitted = yield* store.withAccount(actor.user.id, (tx) =>
          Effect.gen(function* () {
            if (tx.profile.email !== actor.user.email) {
              return yield* new AccountEmailError({ reason: "Changed" })
            }
            if (!tx.profile.emailVerified) {
              return yield* new AccountEmailError({
                reason: "NeedsVerification",
              })
            }
            const record = yield* tx.create(newEmail)
            const state = yield* Ref.make(record)
            const outgoing = yield* Ref.make<ReadonlyArray<EmailMessage>>([])
            const scoped = runtime.scoped(tx.database, {
              ...noCallbacks,
              old: (input) =>
                Effect.runPromise(
                  Effect.gen(function* () {
                    if (
                      input.user.id !== record.data.userId ||
                      input.user.email !== record.data.fromEmail ||
                      input.newEmail !== record.data.toEmail
                    ) {
                      return yield* new AccountEmailError({ reason: "Changed" })
                    }
                    yield* Ref.update(state, (record): EmailChangeRecord => ({
                      ...record,
                      data: {
                        ...record.data,
                        oldTokenHash: hashApiKey(input.token),
                      },
                    }))
                    yield* Ref.update(
                      outgoing,
                      (messages): ReadonlyArray<EmailMessage> => [
                        ...messages,
                        {
                          kind: "confirm-email-change",
                          to: record.data.fromEmail,
                          newEmail: record.data.toEmail,
                          messageId: record.id,
                          expiresInMinutes: 30,
                          actionUrl: emailChangeProofUrl(
                            runtime.baseURL,
                            record.id,
                            input.token,
                          ),
                        },
                      ],
                    )
                  }),
                ),
            })
            yield* emailProviderCall(() =>
              scoped.api.changeEmail({
                headers,
                body: {
                  newEmail,
                  callbackURL: new URL("/account/email-change", runtime.baseURL)
                    .href,
                },
              }),
            )
            const updated = yield* Ref.get(state)
            yield* tx.save(updated)
            return { record: updated, messages: yield* Ref.get(outgoing) }
          }),
        )
        yield* sendAfterCommit(submitted.record, submitted.messages)
        return { requested: true as const }
      })
      const status = Effect.fn("EmailChange.status")(function* (
        headers: Headers,
      ) {
        const actor = yield* emailActor(headers)
        const status = yield* store.status(actor.user.id)
        return {
          userId: actor.user.id,
          available: Boolean(runtime.delivery),
          verified: actor.user.emailVerified,
          currentSessionId: actor.session.id,
          active: Option.match(status.active, {
            onNone: () => null,
            onSome: safeView,
          }),
          notices: Array.map(status.notices, safeView),
        }
      })
      const cancel = Effect.fn("EmailChange.cancel")(function* (
        headers: Headers,
        id: string,
        currentSessionId: string,
      ) {
        const actor = yield* emailActor(headers, currentSessionId)
        yield* store.withAccount(actor.user.id, (tx) => tx.cancel(id))
        return { cancelled: true as const }
      })
      const retryNotice = Effect.fn("EmailChange.retryNotice")(function* (
        headers: Headers,
        id: string,
        currentSessionId: string,
      ) {
        yield* requireDelivery()
        const actor = yield* emailActor(headers, currentSessionId)
        yield* emailBudget(`email-change-notice:${actor.user.id}`, 3)
        const record = yield* store.withAccount(actor.user.id, (tx) =>
          Effect.gen(function* () {
            const record = yield* tx.get(id)
            if (record.data.step !== "completed") {
              return yield* new AccountEmailError({ reason: "Changed" })
            }
            return record
          }),
        )
        yield* sendAfterCommit(record, [emailChangeNotice(record)])
        return { submitted: true as const }
      })
      const verify = Effect.fn("EmailChange.verify")(function* (
        headers: Headers,
        id: string,
        token: string,
      ) {
        yield* requireDelivery()
        yield* emailBudget("email-change-proof-service", 300, 60)
        const located = yield* store.get(id)
        const hash = hashApiKey(token)
        const committed = yield* store.withAccount(located.data.userId, (tx) =>
          Effect.gen(function* () {
            const record = yield* tx.get(id)
            if (
              record.data.fromEmail !== tx.profile.email ||
              !tx.profile.emailVerified
            ) {
              return yield* new AccountEmailError({ reason: "InvalidLink" })
            }
            const stage = record.data.step
            const expected =
              stage === "confirm-old"
                ? record.data.oldTokenHash
                : record.data.newTokenHash
            if (
              stage === "completed" ||
              expected === null ||
              hash !== expected
            ) {
              return yield* new AccountEmailError({ reason: "InvalidLink" })
            }
            const state = yield* Ref.make(record)
            const outgoing = yield* Ref.make<ReadonlyArray<EmailMessage>>([])
            const scoped = runtime.scoped(tx.database, {
              ...noCallbacks,
              next: (input) =>
                Effect.runPromise(
                  Effect.gen(function* () {
                    if (
                      stage !== "confirm-old" ||
                      input.user.id !== record.data.userId ||
                      input.user.email !== record.data.toEmail
                    ) {
                      return yield* new AccountEmailError({
                        reason: "InvalidLink",
                      })
                    }
                    yield* Ref.update(state, (record): EmailChangeRecord => ({
                      ...record,
                      data: {
                        ...record.data,
                        step: "verify-new",
                        oldTokenHash: null,
                        newTokenHash: hashApiKey(input.token),
                        delivery: "pending",
                      },
                    }))
                    yield* Ref.update(
                      outgoing,
                      (messages): ReadonlyArray<EmailMessage> => [
                        ...messages,
                        {
                          kind: "change-email",
                          to: record.data.toEmail,
                          messageId: record.id,
                          expiresInMinutes: Math.max(
                            1,
                            Math.ceil(
                              (record.expiresAt.getTime() - Date.now()) /
                                60_000,
                            ),
                          ),
                          actionUrl: emailChangeProofUrl(
                            runtime.baseURL,
                            record.id,
                            input.token,
                          ),
                        },
                      ],
                    )
                  }),
                ),
            })
            const native = yield* emailProviderCall(() =>
              scoped.api.verifyEmail({
                headers,
                query: { token },
                asResponse: true,
              }),
            )
            if (!native.ok || record.expiresAt.getTime() <= Date.now()) {
              return yield* new AccountEmailError({ reason: "InvalidLink" })
            }
            const updated = yield* Ref.get(state)
            if (stage === "confirm-old") {
              if (updated.data.step !== "verify-new") {
                return yield* new AccountEmailError({ reason: "InvalidLink" })
              }
              yield* tx.checkEmail(record.data.fromEmail)
              yield* tx.save(updated)
              return {
                record: updated,
                messages: yield* Ref.get(outgoing),
                cookies: native.headers.getSetCookie(),
                complete: false,
              }
            }
            yield* tx.checkEmail(record.data.toEmail)
            yield* tx.invalidateRecovery(record.id)
            yield* revokeAllAgentAccessConnectionsForUser(
              record.data.userId,
            ).pipe(Effect.provideService(Database, tx.database))
            const providerContext = yield* emailProviderCall(
              () => scoped.$context,
            )
            yield* emailProviderCall(() =>
              providerContext.internalAdapter.deleteUserSessions(
                record.data.userId,
              ),
            )
            const signedOut = yield* emailProviderCall(() =>
              scoped.api.signOut({ headers, asResponse: true }),
            )
            const completed: EmailChangeRecord = {
              ...updated,
              expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
              data: {
                ...updated.data,
                step: "completed",
                oldTokenHash: null,
                newTokenHash: null,
                delivery: "pending",
              },
            }
            yield* tx.save(completed)
            return {
              record: completed,
              messages: [emailChangeNotice(completed)],
              cookies: signedOut.headers.getSetCookie(),
              complete: true,
            }
          }),
        )
        const submitted = yield* sendAfterCommit(
          committed.record,
          committed.messages,
        ).pipe(Effect.result)
        const result: EmailChangeResult = Result.match(submitted, {
          onFailure: () =>
            committed.complete ? "complete-notice-failed" : "delivery-failed",
          onSuccess: () => (committed.complete ? "complete" : "check-new"),
        })
        const receipt = yield* Effect.sync(() =>
          randomBytes(32).toString("base64url"),
        )
        yield* store.saveReceipt(
          hashApiKey(receipt),
          committed.record.data.userId,
          result,
        )
        const responseHeaders = new Headers({
          location: new URL("/account/email-change", runtime.baseURL).href,
          "cache-control": "no-store",
          "referrer-policy": "no-referrer",
        })
        Array.forEach(committed.cookies, (cookie) =>
          responseHeaders.append("set-cookie", cookie),
        )
        responseHeaders.append(
          "set-cookie",
          `${receiptCookie}=${receipt}; Path=/account/email-change; HttpOnly; SameSite=Lax; Max-Age=300${new URL(runtime.baseURL).protocol === "https:" ? "; Secure" : ""}`,
        )
        return new Response(null, { status: 303, headers: responseHeaders })
      })
      const provide = Effect.provideService(AccountEmailRuntime, runtime)
      return {
        request: (...input: Parameters<typeof request>) =>
          request(...input).pipe(provide),
        status: (...input: Parameters<typeof status>) =>
          status(...input).pipe(provide),
        cancel: (...input: Parameters<typeof cancel>) =>
          cancel(...input).pipe(provide),
        retryNotice: (...input: Parameters<typeof retryNotice>) =>
          retryNotice(...input).pipe(provide),
        verify: (...input: Parameters<typeof verify>) =>
          verify(...input).pipe(provide),
        receiptCookie,
        consumeResult: (receipt: string) =>
          store.consumeReceipt(hashApiKey(receipt)),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make)
}
