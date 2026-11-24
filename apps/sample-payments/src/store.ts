import { DatabaseSync } from "node:sqlite"
import { Data, Effect, Schema } from "effect"
import type { ConfirmationOutcome } from "./decision.js"
import type { PaymentResult } from "./decision.js"

export class PaymentStoreError extends Data.TaggedError("PaymentStoreError")<{
  readonly reason: string
}> {}

const PaymentRowSchema = Schema.Struct({
  id: Schema.String,
  amount_cents: Schema.Number,
  status: Schema.Literals(["pending", "confirmed"]),
  change_id: Schema.String,
  provider_change_id: Schema.NullOr(Schema.String),
  outcome: Schema.Literals([
    "linked",
    "unlinked-receipt",
    "other-change",
    "missing-link",
    "timeout",
    "rolled-back",
    "pending",
  ]),
  attempts: Schema.Number,
})

export type PaymentStore = {
  readonly database: DatabaseSync
  readonly close: () => void
}

export function openStore(path: string): PaymentStore {
  const database = new DatabaseSync(path)
  database.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      change_id TEXT NOT NULL,
      provider_change_id TEXT,
      outcome TEXT NOT NULL,
      attempts INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      payment_id TEXT PRIMARY KEY,
      provider_change_id TEXT
    );
  `)
  return {
    database,
    close: () => database.close(),
  }
}

export function insertPending(
  store: PaymentStore,
  payment: {
    readonly id: string
    readonly amountCents: number
    readonly changeId: string
  },
) {
  return Effect.try({
    try: () => {
      store.database
        .prepare(
          `INSERT INTO payments (
            id, amount_cents, status, change_id, provider_change_id, outcome, attempts
          ) VALUES (?, ?, 'pending', ?, NULL, 'pending', 0)`,
        )
        .run(payment.id, payment.amountCents, payment.changeId)
    },
    catch: () =>
      new PaymentStoreError({
        reason: "The payment record could not be stored.",
      }),
  })
}

export function beginReceipt(store: PaymentStore, paymentId: string) {
  return Effect.try({
    try: () => {
      const db = store.database
      db.exec("BEGIN")
      db.prepare(
        `INSERT INTO receipts (payment_id, provider_change_id) VALUES (?, NULL)`,
      ).run(paymentId)
    },
    catch: () =>
      new PaymentStoreError({
        reason: "The provider receipt could not be started.",
      }),
  })
}

export function rollbackReceipt(store: PaymentStore) {
  return Effect.try({
    try: () => store.database.exec("ROLLBACK"),
    catch: () =>
      new PaymentStoreError({
        reason: "The provider receipt could not be rolled back.",
      }),
  })
}

export function recordOutcome(
  store: PaymentStore,
  paymentId: string,
  attempts: number,
  decision: {
    readonly status: "pending" | "confirmed"
    readonly outcome: ConfirmationOutcome
    readonly providerChangeId: string | null
  },
) {
  return Effect.try({
    try: () => {
      store.database
        .prepare(
          `UPDATE payments
           SET status = ?, outcome = ?, provider_change_id = ?, attempts = ?
           WHERE id = ?`,
        )
        .run(
          decision.status,
          decision.outcome,
          decision.providerChangeId,
          attempts,
          paymentId,
        )
    },
    catch: () =>
      new PaymentStoreError({
        reason: "The payment outcome could not be stored.",
      }),
  })
}

export function commitDecision(
  store: PaymentStore,
  paymentId: string,
  attempts: number,
  decision: {
    readonly status: "pending" | "confirmed"
    readonly outcome: ConfirmationOutcome
    readonly providerChangeId: string | null
  },
) {
  return Effect.try({
    try: () => {
      const db = store.database
      db.prepare(
        `UPDATE payments
         SET status = ?, outcome = ?, provider_change_id = ?, attempts = ?
         WHERE id = ?`,
      ).run(
        decision.status,
        decision.outcome,
        decision.providerChangeId,
        attempts,
        paymentId,
      )
      if (decision.status === "confirmed") {
        db.prepare(
          `UPDATE receipts SET provider_change_id = ? WHERE payment_id = ?`,
        ).run(decision.providerChangeId, paymentId)
      } else {
        db.prepare(`DELETE FROM receipts WHERE payment_id = ?`).run(paymentId)
      }
      db.exec("COMMIT")
    },
    catch: () =>
      new PaymentStoreError({
        reason: "The provider result could not be stored.",
      }),
  })
}

export function readPayment(store: PaymentStore, id: string) {
  return Effect.try({
    try: () =>
      store.database
        .prepare(
          `SELECT id, amount_cents, status, change_id, provider_change_id, outcome, attempts
           FROM payments WHERE id = ?`,
        )
        .get(id),
    catch: () =>
      new PaymentStoreError({
        reason: "The payment record could not be read.",
      }),
  }).pipe(
    Effect.flatMap((row) => {
      if (row === undefined) {
        return Effect.fail(
          new PaymentStoreError({ reason: "The payment record is missing." }),
        )
      }
      return Schema.decodeUnknownEffect(PaymentRowSchema)(row).pipe(
        Effect.map((decoded): PaymentResult => ({
          id: decoded.id,
          amountCents: decoded.amount_cents,
          status: decoded.status,
          outcome: decoded.outcome,
          changeId: decoded.change_id,
          providerChangeId: decoded.provider_change_id,
          attempts: decoded.attempts,
        })),
        Effect.mapError(
          () =>
            new PaymentStoreError({ reason: "The stored payment is invalid." }),
        ),
      )
    }),
  )
}

export function receiptCount(store: PaymentStore, paymentId: string) {
  return Effect.try({
    try: () => {
      const row = store.database
        .prepare(`SELECT COUNT(*) AS count FROM receipts WHERE payment_id = ?`)
        .get(paymentId) as { count: number } | undefined
      return row?.count ?? 0
    },
    catch: () =>
      new PaymentStoreError({
        reason: "The provider receipt could not be read.",
      }),
  })
}
