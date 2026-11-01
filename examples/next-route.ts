import { createFlowmark } from "@flowmarkdev/node/next"

interface TicketDraft {
  readonly customerId: string
  readonly subject: string
}

interface Ticket {
  readonly id: string
}

declare function insertTicket(draft: TicketDraft): Promise<Ticket>

/**
 * Server-only Next.js client. It drains with `after()` and does not
 * expose `shutdown()` or `flush()`. Do not import this from a Client
 * Component, middleware, or render.
 */
const flowmark = createFlowmark({
  onDeliveryHealth(health) {
    if (health.dropped > 0 || health.failed > 0) {
      console.error("[Flowmark] Delivery degraded", {
        dropped: health.dropped,
        failed: health.failed,
        lastFailure: health.lastFailure?.type,
      })
    }
  },
})

export async function createTicket(draft: TicketDraft): Promise<Ticket> {
  const flow = flowmark.workflow("support.ticket", {
    properties: { customerId: draft.customerId },
  })

  try {
    const ticket = await flow.operation("insert-ticket", () =>
      insertTicket(draft),
    )
    flow.done({ outcome: "created", result: { ticketId: ticket.id } })
    return ticket
  } catch (cause) {
    flow.fail({ code: "TICKET_CREATE_FAILED" })
    throw cause
  }
}
