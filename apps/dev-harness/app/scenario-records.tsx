import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@flowmark/ui"
import {
  invoiceSource,
  order,
  stockRows,
  type Area,
  type BusinessScenarioId,
  type Execution,
} from "../lib/operations-catalog"

export function ScenarioRecords({
  area,
  scenario,
  execution,
}: {
  area: Area
  scenario: BusinessScenarioId
  execution?: Execution
}) {
  if (area === "invoices") {
    const invoices = invoiceSource(scenario === "invoices-clean")
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Source validation</TableHead>
            <TableHead>Latest execution</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((row) => (
            <TableRow key={row.reference}>
              <TableCell className="font-medium">{row.reference}</TableCell>
              <TableCell>{row.customer}</TableCell>
              <TableCell>{row.amount}</TableCell>
              <TableCell className="min-w-40 text-xs text-muted-foreground">
                {row.issue ?? "Valid"}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    execution
                      ? row.issue
                        ? "destructive"
                        : "success"
                      : "outline"
                  }
                >
                  {execution
                    ? row.issue
                      ? "Rejected"
                      : "Imported"
                    : "Not run"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }
  if (area === "inventory") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Supplier stock</TableHead>
            <TableHead>Page</TableHead>
            <TableHead>Latest execution</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stockRows.map((row) => {
            const updated =
              execution && (execution.status === "completed" || row.page < 3)
            return (
              <TableRow key={row.sku}>
                <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                <TableCell>{row.product}</TableCell>
                <TableCell>{row.stock}</TableCell>
                <TableCell>{row.page}</TableCell>
                <TableCell>
                  <Badge variant={updated ? "success" : "outline"}>
                    {updated
                      ? "Updated"
                      : execution
                        ? "Not confirmed"
                        : "Not run"}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Items</TableHead>
          <TableHead>Total</TableHead>
          <TableHead>Carrier</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">{order.reference}</TableCell>
          <TableCell>{order.customer}</TableCell>
          <TableCell>{order.items}</TableCell>
          <TableCell>{order.total}</TableCell>
          <TableCell>{order.carrier}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}
