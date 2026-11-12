import { Cause, Effect, Exit } from "effect"
import { DatabaseCancellation, DatabaseError } from "./database.js"
import type { FlowmarkDatabase } from "../client.js"
import type { DatabaseOperation } from "./database-operation.js"

type Transaction = Parameters<Parameters<FlowmarkDatabase["transaction"]>[0]>[0]
export type DatabaseTransaction = Transaction

const transactionFailure = Symbol("Flowmark.TransactionFailure")
type TransactionFailure<E> = { readonly [transactionFailure]: Cause.Cause<E> }
const isTransactionFailure = <E>(
  value: unknown,
): value is TransactionFailure<E> =>
  typeof value === "object" && value !== null && transactionFailure in value

/**
 * Drizzle owns commit/rollback. The callback owns an interruptible child runtime;
 * interruption waits for its finalizers and the transaction's rollback to settle.
 */
export const runTransaction = Effect.fn("runTransaction")(function* <A, E, R>(
  operation: DatabaseOperation,
  transact: <Value>(
    use: (transaction: Transaction) => Promise<Value>,
  ) => Promise<Value>,
  use: (transaction: Transaction) => Effect.Effect<A, E, R>,
) {
  const context = yield* Effect.context<R>()
  const cancel = yield* DatabaseCancellation
  return yield* Effect.callback<A, E | DatabaseError>((resume, signal) => {
    signal.addEventListener("abort", cancel, { once: true })
    // Native Promise calls are confined to this foreign transaction boundary.
    const settled = Promise.resolve()
      .then(() =>
        transact((transaction) =>
          Effect.runPromiseExitWith(context)(
            Effect.suspend(() => use(transaction)),
            { signal },
          ).then((exit) =>
            Exit.match(exit, {
              onSuccess: (value) => value,
              onFailure: (cause) =>
                Promise.reject({
                  [transactionFailure]: cause,
                } satisfies TransactionFailure<E>),
            }),
          ),
        ),
      )
      .then(
        (value) => resume(Effect.succeed(value)),
        (cause: unknown) =>
          resume(
            isTransactionFailure<E>(cause)
              ? Effect.failCause(cause[transactionFailure])
              : Effect.fail(new DatabaseError({ operation, cause })),
          ),
      )
      .finally(() => signal.removeEventListener("abort", cancel))
    return Effect.promise(() => settled)
  })
})
