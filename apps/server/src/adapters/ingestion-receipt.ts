import type { AppendDisposition } from "@flowmark/api"

/** Acknowledges what was persisted without exposing another run's identifiers. */
export const ingestionReceipt = (disposition: AppendDisposition) =>
  disposition === "conflict"
    ? Response.json(
        {
          accepted: false,
          disposition,
          code: "EVENT_CONFLICT",
          error: "Event conflicts with previously accepted telemetry.",
        },
        { status: 409 },
      )
    : Response.json(
        { accepted: disposition !== "ignored", disposition },
        { status: 202 },
      )
