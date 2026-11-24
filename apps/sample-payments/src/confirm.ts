import { Data, Effect } from "effect"
import type { FlowmarkClient } from "@flowmarkdev/node"
import { decideLinked } from "./confirm-linked.js"
import { decideUnlinked } from "./confirm-unlinked.js"
import type { Provider, ProviderAck } from "./provider.js"
import {
  beginReceipt,
  commitDecision,
  insertPending,
  readPayment,
  recordOutcome,
  rollbackReceipt,
  type PaymentStore,
  type PaymentStoreError,
} from "./store.js"

export class ProviderRejected extends Data.TaggedError("ProviderRejected")<{
  readonly reason: string
}> {}

export type ConfirmationRevision = "linked" | "unlinked"

const maxAttempts = 2

export function confirmPayment(input: {
  readonly store: PaymentStore
  readonly provider: Provider
  readonly revision: ConfirmationRevision
  readonly id: string
  readonly amountCents: number
  readonly changeId: string
  readonly flowmark?: FlowmarkClient
}) {
  const run = () => Effect.runPromise(confirm(input))
  const flowmark = input.flowmark
  if (flowmark === undefined) {
    return run()
  }
  return flowmark.workflow("payment.confirm", () => run())
}

const confirm = Effect.fn("SamplePayments.confirm")(function* (input: {
  readonly store: PaymentStore
  readonly provider: Provider
  readonly revision: ConfirmationRevision
  readonly id: string
  readonly amountCents: number
  readonly changeId: string
}) {
  const decide = input.revision === "linked" ? decideLinked : decideUnlinked
  yield* insertPending(input.store, input)
  yield* attempt(input, decide, 1)
  return yield* readPayment(input.store, input.id)
})

const attempt = (
  input: {
    readonly store: PaymentStore
    readonly provider: Provider
    readonly id: string
    readonly changeId: string
  },
  decide: (
    changeId: string,
    ack: ProviderAck,
  ) => ReturnType<typeof decideLinked>,
  attemptNumber: number,
): Effect.Effect<void, PaymentStoreError> =>
  Effect.gen(function* () {
    yield* beginReceipt(input.store, input.id)
    const ack = yield* Effect.tryPromise({
      try: () => input.provider.acknowledge({ changeId: input.changeId }),
      catch: () =>
        new ProviderRejected({ reason: "The provider rejected the request." }),
    }).pipe(
      Effect.catchTag("ProviderRejected", () =>
        rollbackReceipt(input.store).pipe(
          Effect.as({ kind: "rejected" } as const),
        ),
      ),
    )
    if (ack.kind === "rejected") {
      yield* recordOutcome(input.store, input.id, attemptNumber, {
        status: "pending",
        outcome: "rolled-back",
        providerChangeId: null,
      })
      return
    }
    if (ack.kind === "timeout" && attemptNumber < maxAttempts) {
      yield* rollbackReceipt(input.store)
      yield* attempt(input, decide, attemptNumber + 1)
      return
    }
    yield* commitDecision(
      input.store,
      input.id,
      attemptNumber,
      decide(input.changeId, ack),
    )
  })
