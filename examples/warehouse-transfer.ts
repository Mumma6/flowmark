type WarehouseHandoff = {
  readonly transferId: string
  readonly boundary: "pick" | "dock"
  readonly outcome: "acknowledged" | "short" | "confirmed"
  readonly synthetic: true
}

const handoffs = [
  {
    transferId: "T21",
    boundary: "pick",
    outcome: "short",
    synthetic: true,
  },
  {
    transferId: "T21",
    boundary: "dock",
    outcome: "confirmed",
    synthetic: true,
  },
] as const satisfies readonly WarehouseHandoff[]

/** A pick and a later dock confirmation are different boundaries. Both are synthetic. */
export function summarizeWarehouseHandoffs(
  events: readonly WarehouseHandoff[] = handoffs,
) {
  return {
    synthetic: events.every((event) => event.synthetic),
    picks: events.filter((event) => event.boundary === "pick").length,
    docks: events.filter((event) => event.boundary === "dock").length,
    shorts: events.filter((event) => event.outcome === "short").length,
  }
}
