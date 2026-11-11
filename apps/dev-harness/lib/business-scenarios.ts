import { Effect } from "effect"
import type { FlowmarkClient } from "@flowmarkdev/node"
import {
  businessScenarios,
  invoiceSource,
  order,
  stockRows,
  type BusinessScenarioId,
  type Execution,
} from "./operations-catalog"

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function runBusinessScenario(
  client: Pick<FlowmarkClient, "workflow">,
  scenario: BusinessScenarioId,
): Promise<Execution> {
  const definition = businessScenarios.find((item) => item.id === scenario)
  if (!definition) {
    throw new Error(`Unknown application scenario: ${scenario}`)
  }
  const reference =
    definition.area === "invoices"
      ? `BATCH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
      : definition.area === "inventory"
        ? `SYNC-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
        : order.reference
  const flow = client.workflow(definition.workflow, {
    environment: "local",
    release: "operations-harness",
    properties: {
      reference,
      scenario,
      application: "Fieldwork Operations",
      synthetic: true,
    },
  })
  const base = {
    scenario,
    workflow: definition.workflow,
    runId: flow.runId,
    reference,
  }

  if (definition.area === "invoices") {
    const invoices = invoiceSource(scenario === "invoices-clean")
    flow.step("invoice-file-received", {
      properties: {
        filename: "october-invoices.csv",
        records: invoices.length,
      },
    })
    const skipped = invoices.filter((invoice) => invoice.issue).length
    const imported = invoices.length - skipped
    flow.progress({ completed: 0, total: invoices.length, unit: "invoices" })
    await flow.operation("validate-and-save-invoices", async () => {
      await Effect.runPromise(
        Effect.forEach(
          invoices,
          (invoice, index) =>
            Effect.gen(function* () {
              yield* Effect.sleep(140)
              if (invoice.issue) {
                flow.step("invoice-rejected", {
                  properties: {
                    invoiceRef: invoice.reference,
                    reason: invoice.issue,
                  },
                })
                flow.error({
                  code: "INVALID_INVOICE",
                  message: `${invoice.reference}: ${invoice.issue}`,
                  handled: true,
                })
              }
              flow.progress({
                completed: index + 1,
                total: invoices.length,
                unit: "invoices",
              })
            }),
          { concurrency: 1, discard: true },
        ),
      )
    })
    const result = { imported, skipped, total: invoices.length }
    flow.done({ result })
    return {
      ...base,
      status: "completed",
      result,
      summary: `${imported} imported · ${skipped} rejected`,
      nextAction: skipped
        ? "Correct the date on INV-1003 and the amount on INV-1005 in the source file. Re-import only those rejected records in your application."
        : "All invoices imported. No follow-up needed.",
    }
  }

  if (definition.area === "inventory") {
    const interrupted = scenario === "inventory-interrupted"
    flow.step("supplier-sync-started", {
      properties: { supplier: "Studio Supply", pages: 3 },
    })
    flow.progress({ completed: 0, total: stockRows.length, unit: "products" })
    const syncPages = async (
      pages: readonly number[],
      updated: number,
    ): Promise<Execution> => {
      const [page, ...remaining] = pages
      if (page === undefined) {
        return complete(updated)
      }
      const operation = flow.operation("fetch-supplier-page", {
        properties: { page, supplier: "Studio Supply" },
      })
      await pause(320)
      if (interrupted && page === 3) {
        const result = {
          updated,
          expected: stockRows.length,
          lastSavedPage: 2,
        }
        operation.fail({
          code: "SUPPLIER_TIMEOUT",
          message: "Studio Supply timed out on page 3.",
          retryable: true,
        })
        flow.fail({
          code: "SUPPLIER_TIMEOUT",
          message: "Updated 8 products. Page 3 was not received.",
          retryable: true,
          result,
        })
        return {
          ...base,
          status: "failed",
          result,
          summary: "8 updated · 4 not confirmed",
          nextAction:
            "Check supplier availability. Resume from page 3 using the saved checkpoint; pages 1 and 2 already changed stock.",
        }
      }
      operation.done()
      await flow.operation(
        "save-stock-levels",
        async () => {
          await pause(110)
        },
        { properties: { page } },
      )
      const nextUpdated =
        updated + stockRows.filter((item) => item.page === page).length
      flow.step("supplier-page-saved", {
        properties: { page, updated: nextUpdated },
      })
      flow.progress({
        completed: nextUpdated,
        total: stockRows.length,
        unit: "products",
      })
      return syncPages(remaining, nextUpdated)
    }
    const complete = (updated: number): Execution => {
      const result = { updated, expected: stockRows.length }
      flow.done({ result })
      return {
        ...base,
        status: "completed",
        result,
        summary: "12 stock levels updated",
        nextAction:
          "All three supplier pages saved. Stock is ready for the next order.",
      }
    }
    return syncPages([1, 2, 3], 0)
  }

  flow.step("order-loaded", {
    properties: {
      orderId: order.reference,
      items: order.items,
      carrier: order.carrier,
    },
  })
  await flow.operation("reserve-stock", async () => {
    await pause(260)
  })
  flow.step("stock-reserved", {
    properties: {
      orderId: order.reference,
      items: order.items,
      reservationId: `RES-${flow.runId.slice(0, 8)}`,
    },
  })
  const label = flow.operation("create-shipping-label")
  await pause(480)
  if (scenario === "order-carrier-down") {
    const result = { stockReserved: true, labelCreated: false }
    label.fail({
      code: "CARRIER_UNAVAILABLE",
      message: "Parcel Express returned HTTP 503.",
      retryable: true,
    })
    flow.fail({
      code: "SHIPPING_LABEL_FAILED",
      message: "Stock is reserved, but no shipping label was created.",
      retryable: true,
      result,
    })
    return {
      ...base,
      status: "failed",
      result,
      summary: "Stock reserved · shipping blocked",
      nextAction:
        "Check the carrier and retry label creation against the existing reservation. Do not rerun the entire order or reserve stock again.",
    }
  }
  label.done()
  flow.step("ready-for-dispatch", {
    properties: {
      orderId: order.reference,
      labelId: `LBL-${flow.runId.slice(0, 8)}`,
    },
  })
  const result = { items: order.items, stockReserved: true, labelCreated: true }
  flow.done({ result })
  return {
    ...base,
    status: "completed",
    result,
    summary: "3 items reserved · ready for dispatch",
    nextAction: "The warehouse can print the label and dispatch the order.",
  }
}
