import { Match } from "effect"
import type { AppendDisposition } from "@flowmark/api"

/** Acknowledges only authorized effective facts; no foreign identifiers. */
export const ingestionReceipt = (disposition: AppendDisposition) =>
  Match.value(disposition).pipe(
    Match.when("conflict", () =>
      Response.json(
        {
          accepted: false,
          disposition: "conflict",
          code: "EVENT_CONFLICT",
          error: "Event conflicts with previously accepted telemetry.",
        },
        { status: 409 },
      ),
    ),
    Match.when("expectation_conflict", () =>
      Response.json(
        {
          accepted: false,
          disposition: "conflict",
          code: "EXPECTATION_CONFLICT",
        },
        { status: 409 },
      ),
    ),
    Match.when("expectation_closed", () =>
      Response.json(
        {
          accepted: false,
          disposition: "conflict",
          code: "EXPECTATION_DECLARATION_CLOSED",
        },
        { status: 409 },
      ),
    ),
    Match.when("expectation_limit", () =>
      Response.json(
        { accepted: false, code: "EXPECTATION_LIMIT_REACHED" },
        { status: 429 },
      ),
    ),
    Match.orElse((value) =>
      Response.json(
        {
          accepted: value !== "ignored",
          disposition: value,
          capabilities: ["attempts-v1", "expectations-v1"],
        },
        { status: 202 },
      ),
    ),
  )
