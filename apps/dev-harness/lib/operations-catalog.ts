import { Schema } from "effect"

export const scenarioIds = [
  "invoices-clean",
  "invoices-rejected",
  "inventory-complete",
  "inventory-interrupted",
  "order-shipped",
  "order-carrier-down",
] as const
export type BusinessScenarioId = (typeof scenarioIds)[number]
export type Area = "invoices" | "inventory" | "orders"

export const businessScenarios: ReadonlyArray<{
  id: BusinessScenarioId
  area: Area
  title: string
  workflow: string
  expected: string
}> = [
  {
    id: "invoices-clean",
    area: "invoices",
    title: "Valid invoice file",
    workflow: "invoices.import",
    expected: "5 imported. Nothing rejected.",
  },
  {
    id: "invoices-rejected",
    area: "invoices",
    title: "Two invalid invoices",
    workflow: "invoices.import",
    expected:
      "3 imported, 2 rejected. The run completes; the batch needs attention.",
  },
  {
    id: "inventory-complete",
    area: "inventory",
    title: "Supplier available",
    workflow: "inventory.sync",
    expected: "12 stock levels updated across 3 pages.",
  },
  {
    id: "inventory-interrupted",
    area: "inventory",
    title: "Supplier times out on page 3",
    workflow: "inventory.sync",
    expected:
      "8 stock levels updated before failure. The remaining 4 are not confirmed.",
  },
  {
    id: "order-shipped",
    area: "orders",
    title: "Carrier available",
    workflow: "orders.fulfill",
    expected:
      "Stock reserved and a shipping label created. Ready for dispatch.",
  },
  {
    id: "order-carrier-down",
    area: "orders",
    title: "Carrier unavailable",
    workflow: "orders.fulfill",
    expected:
      "Stock reserved, but no label created. Do not reserve stock a second time.",
  },
]

export const invoiceRows = [
  {
    reference: "INV-1001",
    customer: "Birch Studio",
    amount: "€480",
    issue: null,
  },
  {
    reference: "INV-1002",
    customer: "Harbor Books",
    amount: "€1,250",
    issue: null,
  },
  {
    reference: "INV-1003",
    customer: "Meadow Cafe",
    amount: "€320",
    issue: "Invoice date is missing.",
  },
  {
    reference: "INV-1004",
    customer: "Birch Studio",
    amount: "€760",
    issue: null,
  },
  {
    reference: "INV-1005",
    customer: "Cedar Workshop",
    amount: "Invalid",
    issue: "Invoice amount is invalid.",
  },
] as const

export const stockRows = [
  { sku: "DESK-01", product: "Oak desk", stock: 24, page: 1 },
  { sku: "CHAIR-02", product: "Task chair", stock: 42, page: 1 },
  { sku: "LAMP-03", product: "Desk lamp", stock: 18, page: 1 },
  { sku: "SHELF-04", product: "Wall shelf", stock: 31, page: 1 },
  { sku: "TRAY-05", product: "Paper tray", stock: 56, page: 2 },
  { sku: "MAT-06", product: "Desk mat", stock: 38, page: 2 },
  { sku: "STAND-07", product: "Monitor stand", stock: 17, page: 2 },
  { sku: "HOOK-08", product: "Coat hook", stock: 63, page: 2 },
  { sku: "BIN-09", product: "Storage bin", stock: 29, page: 3 },
  { sku: "CLOCK-10", product: "Wall clock", stock: 14, page: 3 },
  { sku: "BOARD-11", product: "Pinboard", stock: 22, page: 3 },
  { sku: "RACK-12", product: "Letter rack", stock: 45, page: 3 },
] as const

export function invoiceSource(clean: boolean) {
  return invoiceRows.map((row) =>
    clean
      ? {
          ...row,
          amount: row.amount === "Invalid" ? "€195" : row.amount,
          issue: null,
        }
      : row,
  )
}

export const order = {
  reference: "ORD-2048",
  customer: "Birch Studio",
  items: 3,
  total: "€586",
  carrier: "Parcel Express",
} as const

export const ExecutionSchema = Schema.Struct({
  scenario: Schema.Literal(...scenarioIds),
  workflow: Schema.String,
  runId: Schema.String,
  reference: Schema.String,
  status: Schema.Literal("completed", "failed"),
  summary: Schema.String,
  nextAction: Schema.String,
  result: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
  }),
})
export type Execution = typeof ExecutionSchema.Type
