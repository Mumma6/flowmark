import type { RunSpec, makeRun } from "./events.js"
export const notificationBuilder = (
  build: (spec: RunSpec) => ReturnType<typeof makeRun>,
) => {
  return (
    key: string,
    at: number,
    parentRunId: string,
    correlationId: string,
    properties: RunSpec["properties"],
    pick: number,
  ) => {
    const permanent = pick < 0.018
    const temporary = pick >= 0.018 && pick < 0.035
    const pending = pick >= 0.035 && pick < 0.08
    return build({
      workflow: "notification.dispatch",
      key,
      at,
      duration: 650,
      parentRunId,
      correlationId,
      properties: {
        ...properties,
        integration: "meridian-notify",
        channel: "synthetic-push",
      },
      result: temporary
        ? { requested: 1 }
        : pending
          ? { requested: 1, pending: 1, reasons: { awaiting_ack: 1 } }
          : {
              requested: 1,
              delivered: Number(!permanent),
              rejected: Number(permanent),
              reasons: permanent ? { destination_rejected: 1 } : {},
            },
      failure: temporary ? "NOTIFICATION_PROVIDER_TIMEOUT" : undefined,
      outcome: temporary
        ? undefined
        : permanent
          ? "rejected"
          : pending
            ? "pending_ack"
            : "delivered",
      expectation: pending ? "on-time" : undefined,
    })
  }
}
