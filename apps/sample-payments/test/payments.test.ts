import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { after, before, describe, it } from "node:test"
import { Effect } from "effect"
import {
  createFlowmarkWithTransport,
  FlowmarkDeliveryError,
} from "@flowmarkdev/node"
import { confirmPayment } from "../src/confirm.js"
import { recordsSameChange } from "../src/decision.js"
import { flowmarkBinding } from "../src/flowmark.js"
import { createProvider, type ProviderMode } from "../src/provider.js"
import { openStore, readPayment, receiptCount } from "../src/store.js"
import { start } from "../src/server.js"

const changeId = "change-100"

async function payment(
  directory: string,
  mode: ProviderMode,
  revision: "linked" | "unlinked",
  flowmark?: Parameters<typeof confirmPayment>[0]["flowmark"],
) {
  const path = join(directory, `${revision}-${mode}.sqlite`)
  const store = openStore(path)
  const provider = createProvider(mode)
  const result = await confirmPayment({
    store,
    provider,
    revision,
    id: `${revision}-${mode}`,
    amountCents: 1250,
    changeId,
    flowmark,
  })
  store.close()
  const reopened = openStore(path)
  const stored = await Effect.runPromise(readPayment(reopened, result.id))
  const receipts = await Effect.runPromise(receiptCount(reopened, result.id))
  reopened.close()
  return { result, stored, receipts, attempts: provider.attempts() }
}

describe("sample payments", () => {
  let directory = ""
  before(async () => {
    directory = await mkdtemp(join(tmpdir(), "sample-payments-"))
  })
  after(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it("confirms a linked receipt and keeps it across a new database connection", async () => {
    const { stored, receipts } = await payment(directory, "same", "linked")
    assert.equal(stored.status, "confirmed")
    assert.equal(stored.outcome, "linked")
    assert.equal(stored.providerChangeId, changeId)
    assert.equal(receipts, 1)
  })

  it("lets the unlinked revision pass the happy path without recording the change", async () => {
    const { stored, receipts } = await payment(directory, "same", "unlinked")
    assert.equal(stored.status, "confirmed")
    assert.equal(stored.outcome, "unlinked-receipt")
    assert.equal(stored.providerChangeId, changeId)
    assert.equal(receipts, 1)
  })

  it("does not treat a provider acknowledgement of another change as the same payment", async () => {
    const linked = await payment(directory, "other", "linked")
    const unlinked = await payment(directory, "other", "unlinked")
    assert.equal(linked.stored.status, "pending")
    assert.equal(linked.stored.outcome, "other-change")
    assert.equal(unlinked.stored.status, "confirmed")
    assert.equal(recordsSameChange(linked.stored, unlinked.stored), false)
  })

  it("keeps a missing provider change unconfirmed when the revision requires a link", async () => {
    const linked = await payment(directory, "missing", "linked")
    const unlinked = await payment(directory, "missing", "unlinked")
    assert.equal(linked.stored.outcome, "missing-link")
    assert.equal(linked.stored.status, "pending")
    assert.equal(unlinked.stored.status, "confirmed")
    assert.equal(unlinked.stored.providerChangeId, null)
    assert.equal(recordsSameChange(linked.stored, unlinked.stored), false)
  })

  it("retries a late acknowledgement and stores the second result", async () => {
    const { stored, attempts } = await payment(directory, "late", "linked")
    assert.equal(attempts, 2)
    assert.equal(stored.attempts, 2)
    assert.equal(stored.outcome, "linked")
  })

  it("rolls back a rejected provider write and leaves no receipt", async () => {
    const { stored, receipts } = await payment(directory, "fail", "linked")
    assert.equal(stored.status, "pending")
    assert.equal(stored.outcome, "rolled-back")
    assert.equal(receipts, 0)
  })

  it("keeps a provider timeout as the payment result when Flowmark delivery fails", async () => {
    const client = createFlowmarkWithTransport({
      transport: { emit: () => Effect.fail(new Error("delivery failed")) },
    })
    const { stored } = await payment(directory, "none", "linked", client)
    assert.equal(stored.outcome, "timeout")
    assert.equal(stored.status, "pending")
    await assert.rejects(
      client.shutdown(),
      (error) => error instanceof FlowmarkDeliveryError,
    )
  })

  it("runs with no Flowmark binding", () => {
    assert.equal(flowmarkBinding({}), "unconfigured")
  })

  it("stores a payment through the loopback request and a later read", async () => {
    const savedConfirmation = process.env.PAYMENT_CONFIRMATION
    process.env.PAYMENT_CONFIRMATION = "linked"
    Object.keys(process.env)
      .filter((key) => key.startsWith("FLOWMARK_"))
      .forEach((key) => {
        delete process.env[key]
      })
    const databasePath = join(directory, "http.sqlite")
    const server = start(0, databasePath)
    await new Promise<void>((resolve) =>
      server.once("listening", () => resolve()),
    )
    const address = server.address()
    assert.ok(address && typeof address !== "string")
    const response = await fetch(`http://127.0.0.1:${address.port}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: 1250, provider: "same" }),
    })
    const body = (await response.json()) as {
      synthetic: boolean
      payment: { id: string; outcome: string }
    }
    assert.equal(response.status, 200)
    assert.equal(body.synthetic, true)
    assert.equal(body.payment.outcome, "linked")
    server.close()
    await new Promise<void>((resolve) => server.once("close", () => resolve()))
    const reopened = openStore(databasePath)
    const stored = await Effect.runPromise(
      readPayment(reopened, body.payment.id),
    )
    reopened.close()
    assert.equal(stored.outcome, "linked")
    if (savedConfirmation === undefined) {
      delete process.env.PAYMENT_CONFIRMATION
    } else {
      process.env.PAYMENT_CONFIRMATION = savedConfirmation
    }
  })
})
